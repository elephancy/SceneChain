"""Real local HTTP and public source-checksum compatibility regressions."""
import hashlib
import http.server
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BenchmarkSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.foreign_requests = []

        class Foreign(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                cls.foreign_requests.append(self.path)
                self.send_response(200)
                self.end_headers()

            def log_message(self, *_):
                pass

        cls.foreign = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Foreign)
        cls.foreign_thread = threading.Thread(target=cls.foreign.serve_forever, daemon=True)
        cls.foreign_thread.start()
        foreign = f"http://127.0.0.1:{cls.foreign.server_port}/data"

        class Origin(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                redirects = {
                    "/redirect": "/data",
                    "/foreign": foreign,
                    "/userinfo": f"http://fixture:never-issued@127.0.0.1:{self.server.server_port}/data",
                    "/file": "file:///unread-fixture",
                }
                if self.path in redirects:
                    self.send_response(302)
                    self.send_header("Location", redirects[self.path])
                    self.end_headers()
                    return
                body = b"x" * 64 if self.path == "/oversized" else b'{"status":"ok"}'
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_):
                pass

        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Origin)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        for server, thread in ((cls.server, cls.thread), (cls.foreign, cls.foreign_thread)):
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def setUp(self):
        self.benchmark = load("scenechain_benchmark", ROOT / "scripts/benchmark.py")
        self.benchmark.BASE = self.base
        self.benchmark.OPENER = self.benchmark.make_opener(self.base)
        self.foreign_requests.clear()

    def test_configured_local_http_and_base_path_are_preserved(self):
        self.benchmark.BASE = self.base + "/prefix"
        elapsed, status, size = self.benchmark.timed("/data")
        self.assertGreaterEqual(elapsed, 0)
        self.assertEqual((status, size), (200, 15))

    def test_https_and_ipv6_configuration_are_accepted(self):
        self.assertEqual(self.benchmark.http_origin("https://localhost:8443/path"),
                         ("https", "localhost", 8443))
        self.assertEqual(self.benchmark.http_origin("http://[::1]:8088/path"),
                         ("http", "::1", 8088))
        self.assertEqual(self.benchmark.http_origin("http://localhost:0/path")[2], 0)

    def test_same_origin_redirect_is_supported(self):
        self.assertEqual(self.benchmark.timed("/redirect")[1:], (200, 15))

    def test_cross_origin_redirect_is_rejected_before_any_request(self):
        request = urllib.request.Request(self.base + "/foreign", headers={"Authorization": "Bearer never-issued-fixture"})
        with self.assertRaises(ValueError):
            self.benchmark.OPENER.open(request, timeout=2)
        self.assertEqual(self.foreign_requests, [])

    def test_userinfo_and_non_http_redirects_are_rejected(self):
        for path in ("/userinfo", "/file"):
            with self.subTest(path=path):
                try:
                    self.benchmark.timed(path)
                except urllib.error.HTTPError as error:
                    error.close()
                except ValueError:
                    pass
                else:
                    self.fail("Unsafe redirect must be rejected")

    def test_invalid_base_urls_are_rejected_without_echoing_credentials(self):
        for url in ("file:///tmp/fixture", "ftp://localhost/", "http://fixture:never-issued@localhost/",
                    "http://localhost:invalid/", "http://localhost/path?fixture=1",
                    "http://localhost/#fixture", "http://localhost/\r\nfixture", "http:///missing"):
            with self.subTest(kind=url.split(":", 1)[0]), self.assertRaises(ValueError) as raised:
                self.benchmark.make_opener(url)
            self.assertNotIn("never-issued", str(raised.exception))

    def test_oversized_response_fails_instead_of_reporting_truncated_measurement(self):
        with patch.object(self.benchmark, "MAX_BODY_BYTES", 32), self.assertRaises(ValueError):
            self.benchmark.timed("/oversized")

    def test_main_retains_report_schema_and_asset_statistics(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for folder in ("delivery", "thumbnails"):
                directory = root / "scene-pack/v1" / folder
                directory.mkdir(parents=True)
                (directory / "one.webp").write_bytes(b"1234")
                (directory / "two.webp").write_bytes(b"123456")
            script = root / "scripts/benchmark.py"
            script.parent.mkdir()
            shutil.copyfile(ROOT / "scripts/benchmark.py", script)
            environment = os.environ.copy()
            environment.update(SCENECHAIN_URL=self.base + "/prefix", SCENECHAIN_BENCHMARK_SAMPLES="1")
            result = subprocess.run([sys.executable, str(script)], env=environment,
                                    capture_output=True, text=True, check=True, timeout=15)
            report = json.loads(result.stdout)
            self.assertEqual(report["samples"], 1)
            self.assertEqual(set(report["http"]), {"landing_ms", "pack_status_ms"})
            self.assertEqual(report["formal_scene_assets"], {"count": 2, "total_bytes": 10, "median_bytes": 5})
            self.assertEqual(report["gallery_thumbnails"]["decoded_rgba_bytes"], 2 * 480 * 320 * 4)


class PublicChecksumCompatibility(unittest.TestCase):
    def test_commons_sha1_format_and_sha256_integrity_digest_remain_distinct(self):
        finalizer = load("scenechain_finalizer", ROOT / "scripts/finalize_scene_pack.py")
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "source-fixture"
            path.write_bytes(b"abc")
            self.assertEqual(finalizer.sha1(path), "a9993e364706816aba3e25717850c26c9cd0d89d")
            self.assertEqual(finalizer.digest(path), hashlib.sha256(b"abc").hexdigest())
            path.write_bytes(b"changed")
            self.assertNotEqual(finalizer.sha1(path), "a9993e364706816aba3e25717850c26c9cd0d89d")
            self.assertNotEqual(finalizer.digest(path), hashlib.sha256(b"abc").hexdigest())


if __name__ == "__main__":
    unittest.main()
