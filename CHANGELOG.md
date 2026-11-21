# Changelog

## 0.2.0 – 21 Nov 2026

### Fixed
- Console could not load a workspace: Firestore rules now allow members to list their workspaces (emulator-tested).
- Source linking never matched FreshCart, so diagnosis could not produce a code fix.
- Mis-encoded characters in FreshCart, the extension, the spike page and Android.
- Cloud model name now comes from Remote Config (`dz_cloud_model`) instead of being hard-coded.
- Both models return structured JSON (`responseConstraint` on-device, `responseJsonSchema` in the cloud); Android strips code fences.
- Run documents record the real network profiles and prompt version.
- Re-diagnosing no longer duplicates findings; findings have stable IDs, link to their checks, and move to fixed/regressed automatically.
- Baseline is loaded from the workspace, so regressions work across machines.
- One spinner detector is used for timing and evidence; checks stop waiting once the screen settles.
- Extension storage no longer hits the 10 MB quota (`unlimitedStorage`, quota errors reported).
- Android: field monitor can restart, Firebase/App Check initialise once, pending events are judged in the cloud after reconnect, devices report coverage.
- FreshCart initialises App Check before Firestore writes.

### Added
- Extension rebuilt in TypeScript with a full side panel: Setup, Sweep, Results, Finding detail, Settings; live network/Nano chips; sync counter; before/after slider; diff viewer; "Explain in plain words" using `PREFER_ON_DEVICE`; offline and flaky profiles in one sweep; model availability check.
- Console: workspace onboarding, score trend chart, run filters, QR pairing with 15-minute codes, coverage percentages, field-event thumbnails, workspace settings.
- Firestore rules: pairing-code expiry and schema/size validation for runs, checks, findings, field events and devices.
- Apache-2.0 LICENSE, `.editorconfig`, Prettier, ESLint, encoding check, per-package tsconfigs and scripts, Gradle wrapper and version catalog.

## 0.1.0 – 21 Nov 2026
- Initial prototype: debugger network emulation, on-device judging, Firestore queue, console, FreshCart buggy/fixed, Android spike.
