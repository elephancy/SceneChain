# SceneChain

[![SceneChain CI](https://github.com/elephancy/SceneChain/actions/workflows/ci.yml/badge.svg)](https://github.com/elephancy/SceneChain/actions/workflows/ci.yml)

SceneChain is a research prototype comparing manual password login with a
five-stage graphical passphrase. Each stage combines a location on a stable
full-scene image with a discrete directional action.

The experiment has three conditions:

- a manual password baseline;
- direct SceneChain, optimized for entry speed;
- shielded SceneChain, designed to retain location uncertainty after one
  observed login.

SceneChain is a knowledge factor. It is not phishing-resistant, it is not
multi-factor authentication, and it does not replace passkeys. Direct mode is
assumed compromised after a clear recording. Shielded mode is expected to weaken
across repeated observations. Those boundaries are part of the research.

## Core interaction

During enrollment, a participant receives five system-assigned CC0 cue scenes.
For every scene, the participant chooses any canonical cell
and one of four directions. During authentication, the user recognizes the five scenes
inside a shuffled public scene pool; the server never labels which scenes belong to the account. The five scenes
appear in the same order and the complete chain is evaluated only at the end.

Correctness-dependent scene branching is intentionally prohibited because a
known scene sequence would turn the next scene into a partial-password oracle.

Coordinates are normalized against an immutable 3:2 scene derivative and snapped
to a 24 by 16 grid. Raw pointer coordinates, freehand geometry, pressure, and
timing are not credential material.

## Documents

- [Research review brief](docs/review-brief.md)
- [Frozen protocol](docs/protocol.md)
- [Study plan and preregistration draft](docs/study-plan.md)
- [Participant information and consent](docs/participant-materials.md)
- [Ethics and data-protection package](docs/ethics-and-data-protection.md)
- [Researcher runbook](docs/researcher-runbook.md)
- [Technical assurance](docs/technical-assurance.md)
- [Scene-pack policy and provenance](docs/scene-pack.md)

## Run the prototype

Copy `.env.example` to `.env`, replace every development secret, then run:

```bash
docker compose up --build
```

Open `http://localhost:8088`. PostgreSQL data persists in a named volume; Redis
is deliberately ephemeral because it stores attempts, enrollment state, rate
limits, and sessions. Stop the stack with `docker compose down`. Add `-v` only
when you intentionally want to delete enrolled development accounts.

For local production-profile checks, combine `docker-compose.yml` with
`docker-compose.prod.yml` and supply every required test value. The overlay
enables secure cookies and separates Flyway's migration role from the runtime
application role.

The private deployment controller discovers the exact `main` commit after all
required `SceneChain CI` checks succeed. It owns build policy, registry access,
immutable image promotion, routing, backup, restore, and rollback. This repository
provides application CI and build inputs; it has no production release workflow,
registry identity, deployment manifest, or deployment credentials.

Useful verification commands are:

```bash
docker compose config --quiet
mvn --file backend/pom.xml verify
npm --prefix frontend ci
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend audit --audit-level=high
python3 scripts/validate_scene_pack.py scene-pack/v1/manifest.json
```

The Docker images are runtime images and intentionally omit Maven and Node.js;
run the source-level commands above locally or rely on the equivalent GitHub
Actions jobs. The integration workflow additionally starts a fresh Compose
stack, checks security-negative behavior while recruitment is closed, opens a
clearly labelled disposable local gate, and completes enrollment and
authentication before deleting the test volume.

The local-only scene reviewer binds to loopback and edits the staging manifest
only after explicit operator actions:

```bash
python3 scripts/review_scene_pack.py
```

Open `http://127.0.0.1:8091`. It supports independent crop and eligible-cell
approval and refuses to mark a pack approved until all 48 scenes have both
reviews. Recommended-cell metadata is retained only for offline analysis; the
participant interface exposes all 384 cells and never displays recommendations.
The application backend validates the frozen manifest plus canonical, delivery,
and thumbnail hashes independently at startup. A configured formal pack fails
closed if any check differs.

## Current status

The repository contains the complete in-scope research implementation:
versioned informed consent with an understanding gate, enrollment and two full
confirmations, server-assigned crossover state, direct, shielded, and password
trials, workload and retention flows, constrained secondary-outcome entry,
participant deletion, audited pseudonymised exports, Redis-backed single-use
attempts, PostgreSQL migrations, cryptographic test vectors, responsive public
information, desktop/laptop study UI, and a production-oriented Compose overlay.

The 48-image CC0 pack, protocol, data schema, and technical release identifiers
are frozen. The normative study source is `docs/protocol.md`; consolidated
implementation evidence is in `docs/technical-assurance.md`.
Recruitment remains technically closed until the preregistration identifier,
pilot-derived duration, institutional contacts, compensation, hosting details,
written ethics decision, and written data-protection decision are complete and
recorded in the release gate.

## License

The software and project documentation are licensed under the
[GNU Affero General Public License v3.0](LICENSE), using the
`AGPL-3.0-only` SPDX identifier. Anyone operating a modified version over a
network must make its corresponding source available as required by the
license.

The SceneChain elephant logo in `frontend/public/assets/brand/` is
Copyright © 2026 Mahmoud elfeel. All rights are reserved. The logo and the
SceneChain name are trademark-reserved and are not granted for reuse under the
AGPL.

Only the 48 research scene images listed in
`scene-pack/v1/manifest.json` are separately available under CC0-1.0. Their
per-file source and license evidence remain recorded in that frozen manifest.
Third-party software notices are recorded in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
