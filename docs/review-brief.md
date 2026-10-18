# SceneChain research review brief

## Purpose

SceneChain is a working research prototype comparing a conventional password
with two variants of five-stage graphical authentication. The implementation
and draft research package are ready for academic and institutional review.

No participants are being recruited. The production release gate remains
closed until the study administration, pilot, preregistration, participant
materials, and written institutional decisions are complete.

## Project links

- Live prototype: <https://scenechain.elfeel.me>
- Source repository: <https://github.com/elephancy/SceneChain>
- [Frozen protocol](protocol.md)
- [Study plan and preregistration draft](study-plan.md)
- [Participant information and consent](participant-materials.md)
- [Ethics and data-protection package](ethics-and-data-protection.md)
- [Researcher runbook](researcher-runbook.md)
- [Technical assurance](technical-assurance.md)
- [Scene-pack policy and provenance](scene-pack.md)

## Study summary

The proposed within-participant study compares a study-only password, direct
SceneChain, and shielded SceneChain. Each graphical credential combines one
location and one of four cardinal directions across five system-assigned
scenes. The full chain is evaluated only after the final scene.

The confirmatory target is 72 analyzable adults, with recruitment capped at 90.
Each condition includes practice, three immediate measured trials, workload
ratings, and a delayed retention trial. A separate approved pilot must validate
instructions, session duration, and planning assumptions.

The application excludes direct identity fields, raw pointer coordinates,
graphical secrets, typed passwords, recordings, third-party analytics, and
unrestricted free text from research exports.

## Review requested

The first review should determine:

- whether the research question, comparison, and outcome plan are suitable;
- who should hold the investigator, sponsor, and controller roles;
- which ethics and data-protection processes apply;
- whether and under what conditions the pilot may proceed;
- the recruitment channel, compensation, and permitted pilot size;
- the approved encrypted institutional storage for exports;
- whether the proposed retention and deletion schedule is acceptable;
- which hosting, processor, datacenter, and transfer details must be recorded;
- the preferred preregistration process;
- what revisions are required before institutional submission.

## Fields that remain intentionally open

- investigator names, departments, and institutional contacts;
- sponsor and controller;
- data-protection contact and legal basis;
- committee and approval reference;
- hosting and processor disclosures;
- compensation and payment handling;
- pilot-derived duration;
- complaint routes;
- encrypted export-storage location;
- preregistration identifier;
- written ethics and data-protection decision references.

These values must come from the responsible institution and must not be
guessed.

## Current technical state

The public prototype runs over HTTPS, loads the approved 48-scene CC0 pack,
verifies its frozen digest, and keeps recruitment disabled. CI covers backend,
frontend, integration, container, and pack validation. The release gate requires
matching protocol and pack hashes plus external approval references before
recruitment can be enabled.

The requested outcome of this review is not immediate recruitment approval. It
is a clear institutional route, assigned responsibilities, an approved pilot
plan, and a bounded list of revisions for formal submission.
