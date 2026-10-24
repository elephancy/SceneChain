#!/usr/bin/env python3
"""Bounded HTTP and asset benchmark for a running SceneChain stack."""

import json, os, re, statistics, time, urllib.parse, urllib.request
from pathlib import Path

BASE = os.environ.get("SCENECHAIN_URL", "http://localhost:8088")
SAMPLES = int(os.environ.get("SCENECHAIN_BENCHMARK_SAMPLES", "30"))
MAX_BODY_BYTES = 16 * 1024 * 1024


def http_origin(url: str):
    if re.search(r"[\x00-\x20\x7f]", url):
        raise ValueError("Benchmark URLs must not contain whitespace or control characters")
    try:
        parsed = urllib.parse.urlsplit(url)
        port = parsed.port
        host = parsed.hostname
    except ValueError:
        raise ValueError("Benchmark URL is malformed") from None
    if parsed.scheme not in {"http", "https"} or not host or parsed.username is not None or parsed.password is not None:
        raise ValueError("Benchmark URLs require HTTP(S), a host and no embedded credentials")
    return parsed.scheme, host.lower(), port if port is not None else (443 if parsed.scheme == "https" else 80)


class SameOriginRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, origin):
        self.origin = origin

    def redirect_request(self, request, response, code, message, headers, new_url):
        try:
            if http_origin(new_url) != self.origin:
                raise ValueError("Benchmark redirects must remain on the configured origin")
        except ValueError:
            response.close()
            raise
        return super().redirect_request(request, response, code, message, headers, new_url)


def make_opener(base):
    origin = http_origin(base)
    parsed = urllib.parse.urlsplit(base)
    if parsed.query or parsed.fragment:
        raise ValueError("The benchmark base URL must not contain a query or fragment")
    return urllib.request.build_opener(SameOriginRedirect(origin))


OPENER = make_opener(BASE)

def timed(path: str):
    target = BASE + path
    if http_origin(target) != http_origin(BASE):
        raise ValueError("Benchmark requests must remain on the configured origin")
    start=time.perf_counter();
    with OPENER.open(target, timeout=10) as response:
        body=response.read(MAX_BODY_BYTES + 1); status=response.status
        if len(body) > MAX_BODY_BYTES:
            raise ValueError("Benchmark response exceeds the 16 MiB limit")
    return (time.perf_counter()-start)*1000, status, len(body)

def percentile(values, p):
    ordered=sorted(values); return ordered[min(len(ordered)-1, round((len(ordered)-1)*p))]

def main():
    root=[]; status=[]
    for _ in range(SAMPLES):
        root.append(timed("/")[0]); status.append(timed("/api/pack/status")[0])

    assets=list((Path(__file__).parents[1]/"scene-pack/v1/delivery").glob("*.webp"))
    thumbnails=list((Path(__file__).parents[1]/"scene-pack/v1/thumbnails").glob("*.webp"))
    report={
      "samples":SAMPLES,
      "http":{
        "landing_ms":{"median":round(statistics.median(root),2),"p95":round(percentile(root,.95),2)},
        "pack_status_ms":{"median":round(statistics.median(status),2),"p95":round(percentile(status,.95),2)},
      },
      "formal_scene_assets":{"count":len(assets),"total_bytes":sum(p.stat().st_size for p in assets),
                             "median_bytes":round(statistics.median(p.stat().st_size for p in assets))},
      "gallery_thumbnails":{"count":len(thumbnails),"total_bytes":sum(p.stat().st_size for p in thumbnails),
                             "decoded_rgba_bytes":len(thumbnails)*480*320*4},
      "estimated_gallery_plus_selected_scene_decoded_rgba_bytes":len(thumbnails)*480*320*4+1920*1280*4,
    }
    print(json.dumps(report,indent=2))


if __name__ == "__main__":
    main()
