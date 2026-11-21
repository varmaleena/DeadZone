# Deadzone: code review and end-to-end fix list

Reviewed: 21 Nov 2026, every source file in `F:\DEADZONE` (shared package, extension, console, FreshCart, Android, scripts, tests, rules, CI, docs).
Checks run: `node scripts/check.mjs` (strict TypeScript) passed; `node scripts/test-audit.mjs` passed; a Firestore emulator probe of the console's workspace query **failed** (see P0-1).

## Verdict

The core idea is implemented further than a toy: real debugger network emulation, screenshot pairs, an on-device judge with schema validation and plain-code overrides, a Firestore offline queue, an emulator-tested rules file, and Playwright tests for FreshCart. But it does **not** meet a production or "serious product" bar yet:

- the console cannot load a workspace for a signed-in user (blocking bug);
- the source-linking step finds no files in FreshCart, so the demo's "fix diff" can never appear;
- there is no LICENSE and no git repository (both hackathon Stage 1 requirements);
- the code is written as dense one-line blocks with cross-package `node_modules` path hacks, so it reads like a prototype;
- the extension UI is a single page of buttons, far from the specified 6-screen side panel;
- the Android part is an uncompiled spike, not a FreshCart app.

Rough standard today: **prototype, about 4/10.** Following P0 to P2 below gets it to a credible product (about 8/10); P3 and P4 make it production-grade.

---

## P0 status (updated 21 Nov 2026)

| # | Status |
|---|---|
| P0-1 | **Fixed.** Workspace `get, list` now checks `resource.data.memberUids`; emulator tests added for member list, second member list, and outsider denial. All rules tests pass. **Deploy with `firebase deploy --only firestore:rules`.** |
| P0-2 | **Fixed.** Source linking accepts app source files in any layout (prefers `src/`), excludes dependencies, build output, tests, `.d.ts` and secret-looking files, shows sizes and skipped files, keeps the 60 KB budget. |
| P0-3 | **Fixed.** Apache-2.0 `LICENSE` added; `"license"` set in every `package.json`. |
| P0-4 | **Partly done.** `git init` (branch `main`) done; 94 files ready, no secrets or junk. Commit and push to a public GitHub repo still to do. |
| P0-5 | **Fixed for the repo.** `.gitignore` now excludes `tmp/`, `output/`, logs, `.test-build`, keystores, APKs; `store-dir` removed from `.npmrc`. The old `.pnpm-store/` (581 MB) and `tmp/` are still on disk but ignored; delete them after the next `pnpm install`. |
| P0-6 | **Fixed** (also in the spike page and Android). `.editorconfig` + `pnpm check:encoding` added to CI. |
| P0-7 | **Fixed.** README rewritten. |
| P0-8 | **Partly done.** Gradle 8.11.1 wrapper (checksum-pinned) and a version catalog added; README documents setup. Not compiled: no Android SDK on the review machine. |

## P1–P4 status (updated 21 Nov 2026)

| # | Status |
|---|---|
| P1-1 | **Fixed** (web). Cloud models are created per Remote Config `dz_cloud_model`. Android keeps one constant (`DeadzoneField.CLOUD_MODEL`) to avoid adding an unverified Remote Config dependency. |
| P1-2 | **Fixed.** On-device `responseConstraint` and cloud `responseJsonSchema` from one JSON Schema; Android strips code fences. |
| P1-3 | **Fixed.** Real profiles and prompt version recorded. |
| P1-4 | **Fixed.** Stable finding IDs, `checks` references, `platforms`, `firstSeen/lastSeen`, automatic `fixed` / `regressed`. |
| P1-5 | **Fixed.** Workspace baseline loaded at sweep start; local fallback. |
| P1-6 | **Fixed.** One `snapshotPage` spinner detector for timing and evidence. |
| P1-7 | **Fixed.** Stops when no spinner and the DOM is stable, or when the spinner timeout is reached. |
| P1-8 | **Fixed.** `unlimitedStorage`, only the latest sweep kept, quota errors reported. |
| P1-9 | **Fixed** (uncompiled). Restartable scope, `DeadzoneApp` initialises Firebase/App Check once, pending events judged in the cloud after reconnect, device coverage reported. |
| P1-10 | **Fixed.** FreshCart initialises App Check when a site key is configured. |
| P1-11 | **Fixed.** Onboarding form; per-collection sorting. |
| P2-1 | **Fixed.** Prettier + ESLint configured, whole repo formatted, both enforced in CI. |
| P2-2 | **Fixed.** Every app has its own `package.json`, scripts and dependencies; no cross-package `node_modules` paths. |
| P2-3 | **Fixed.** Extension rewritten in TypeScript (`src/background.ts`, `src/integration.ts`, `src/panel/*`). |
| P2-4 | **Fixed.** `tsconfig.base.json` + one tsconfig per package. |
| P2-5 | **Partly.** `pnpm dev` now starts FreshCart; the spike stays as a documented dev tool. |
| P2-6 | **Fixed.** `.nvmrc`, `engines`, versions 0.2.0, extension icons. |
| P2-7 | **Partly.** Unit tests expanded (finding IDs, resolution, fences, retries, schema agreement); still a custom harness rather than Vitest. |
| P2-8 | **Fixed.** `CHANGELOG.md` added; `docs/build-status.md` kept as history. |
| P3-1 | **Fixed.** Side panel with Setup, Sweep, Results, Finding detail, Settings. Screenshots verified in Chromium. |
| P3-2 | **Fixed.** Network and Nano chips, sync counter in the status bar. |
| P3-3 | **Fixed.** Trend chart, QR pairing, run filters, coverage percentages, field thumbnails, settings. `/preview` kept and labelled as example data, lazy-loaded. |
| P3-4 | **Fixed.** Offline and flaky profiles run per action in one sweep. |
| P3-5 | **Not done.** No FreshCart Compose app; the Android demo is a pairing + self-test screen using the Field SDK. |
| P3-6 | **Fixed.** Model availability checked on open; sweep warns when Nano is unavailable. |
| P4-1 | **Partly.** 8-character codes (no ambiguous characters) with 15-minute expiry enforced in rules. A rate-limited Cloud Function would still be stronger. |
| P4-2 | **Fixed.** Rules validate types, enums and sizes for runs, checks, findings, field events and devices; unknown subcollections denied; emulator tests added. |
| P4-3 | **Documented.** Debug App Check builds are for judging only (extension README). |
| P4-4 | **Not done.** No error telemetry. |
| P4-5 | **Not done.** FreshCart demo orders are not rate-limited. |
| P4-6 | **Partly.** Console preview lazy-loaded; Firebase still makes the console and extension bundles large. |

## P0: Blockers (fix first; the demo or submission fails without these)

| # | Problem | Where | Fix |
|---|---|---|---|
| P0-1 | **Console can't find the user's workspace.** `findWorkspace()` runs `where('memberUids','array-contains',uid)`, but the workspace read rule uses `get()` on the same document (`member(wid)`), which Firestore can't prove for a list query. Emulator probe: **DENIED**. Every signed-in user hits "Unable to load". | `firestore.rules`, `apps/console/src/main.ts` | Split the workspace rule: `allow get, list: if signedIn() && request.auth.uid in resource.data.memberUids;` (no `get()` on itself). Keep `member(wid)` for subcollections. Add an emulator test for the exact console query. |
| P0-2 | **Source linking can never match FreshCart.** The panel only keeps files under a `routes/` or `lib/` folder; FreshCart's code is `src/main.ts`, `src/orders.ts`, `src/cart.ts`. Diagnosis therefore gets no source and `fixDiff` is always empty: the demo's fix step is impossible. | `apps/extension/panel.js` (`#sources` handler) | Replace the folder regex with an allowlist of source extensions under `src/`, excluding tests, `node_modules`, `dist`, env files; show the chosen list with sizes; keep the 60 KB cap. Better: let the plan declare `sourceHints` per action (e.g. `checkout-submit → src/main.ts, src/orders.ts`). |
| P0-3 | **No LICENSE file.** Rules require an open-source licence visible in the repo's About section. | repo root | Add Apache-2.0 `LICENSE`; set `"license": "Apache-2.0"` in package.json files. |
| P0-4 | **Not a git repository.** The submission needs a public GitHub/GitLab repo, and there is no history to show what was built during the contest. | repo root | `git init`, fix `.gitignore` first (P0-5), commit by phase, push to a public GitHub repo. |
| P0-5 | **Junk that would be committed or zipped:** a 581 MB pnpm store inside the repo (`.npmrc` `store-dir=.pnpm-store`), a whole Chrome profile in `tmp/extension-test-profile`, `firestore-debug.log`, `output/`, `test-results/`, `.uv-cache/`, `packages/shared/.test-build/`. | root, `.npmrc`, `.gitignore` | Delete `store-dir` from `.npmrc` (use the global store). Add `tmp/`, `output/`, `**/.test-build/`, `*.log` to `.gitignore`. Delete the folders. Run gitleaks before the first push. |
| P0-6 | **Broken characters in the UI**: the ellipsis in "Loading…", the dot in "Place order · $6.00", the dash in "Offline — showing saved items" and the apostrophe in "You're offline" showed up as runs of odd Latin characters. Files were saved with the wrong encoding. These appear on screen in the demo. | `apps/freshcart/src/main.ts` (4 places), `apps/extension/panel.js` (2) | Re-save as UTF-8 with the intended `…`, `·`, `—`, `’`. Add `.editorconfig` with `charset = utf-8` and a CI check (`scripts/check-encoding.mjs`). **Fixed.** |
| P0-7 | **README is wrong.** It says "Current implementation is Phase 0 only" and only explains the spike; judges read the README first. | `README.md` | Rewrite: problem, solution loop, architecture diagram, how Firebase AI Logic is used (exact files), setup, running each app, tests, demo, limitations, "built Nov 21–30 2026". |
| P0-8 | **Android can't be built by anyone:** no Gradle wrapper, `google-services.json` missing (fine, but undocumented), versions pinned individually instead of the Firebase BoM, and it has never compiled. | `android/` | Add `gradlew` wrapper; use `platform("com.google.firebase:firebase-bom:…")`; document the `google-services.json` step; compile once in Android Studio and fix errors; attach a debug APK to a GitHub Release. |

## P1: Correctness bugs

| # | Problem | Where | Fix |
|---|---|---|---|
| P1-1 | Cloud model name is hard-coded (`gemini-3.5-flash-lite`) and ignores Remote Config `dz_cloud_model`; Android hard-codes it too. | `packages/shared/src/firebase.ts`, `DeadzoneField.kt`, `MainActivity.kt` | Create the cloud model after `loadRubric()` using `rubric.cloudModel`; confirm the model ID exists in the Gemini Developer API; read it from Remote Config on Android. |
| P1-2 | Verdict JSON is requested only by prompt text, so the on-device model often wraps it in prose or code fences (Android doesn't strip fences at all → every field event becomes pending). | `audit.ts`, `DeadzoneField.kt` | Use Firebase AI Logic structured output (`responseMimeType: application/json` + `responseSchema`) on both paths; keep the zod/`JSONObject` validation; strip code fences on Android as a fallback. |
| P1-3 | Run metadata is wrong: `profiles: ['offline']` and `promptVersion: 'v1'` are hard-coded even for flaky sweeps or a new prompt version. | `packages/shared/src/sync.ts` `startRun` | Pass the real profile list and `rubric.promptVersion`. |
| P1-4 | Clicking **Diagnose** twice writes duplicate findings; findings never link to check documents or get marked fixed/regressed by a later run. | `panel.js` diagnose handler | Write findings with a deterministic ID (hash of state + routes) using `set(..., {merge:true})`; store `checkRefs`, `platforms`, `lastSeenRunId`; on a passing re-sweep set `status: fixed`; on a failure after `fixed` set `regressed`. |
| P1-5 | Baseline and regressions live only in `chrome.storage.local`; the workspace's `baselineRunId` is written but never read, so a teammate or a reinstall loses it. | `panel.js`, `sync.ts` | On sweep start, load the baseline run's checks from Firestore when a workspace is paired; fall back to local. |
| P1-6 | Spinner detection is inconsistent: the timing loop checks only `role=progressbar`/`aria-busy`, while the snapshot also counts `.spinner`/`.loader`. A class-only spinner is "seen" but timed as 0 ms. | `panel.js`, `integration.mjs` | Use one shared `findSpinners()` function in both places. |
| P1-7 | Every check always waits the full spinner timeout (10 s) even when the screen settles instantly, so a 5-check sweep takes over a minute. | `panel.js` sweep loop | Stop early when no spinner is visible for `settleMs` and the DOM is stable (MutationObserver quiet period). |
| P1-8 | Screenshots for every sweep are kept in `chrome.storage.local` without `unlimitedStorage`; after a few sweeps the 10 MB quota throws and results stop saving. | `manifest.json`, `panel.js` | Add `unlimitedStorage` or keep only the last N sweeps; catch quota errors and tell the user. |
| P1-9 | Android: `DeadzoneField.stop()` cancels its scope, so the same instance can never `start()` again; `FirebaseApp.initializeApp` and App Check are re-run on every button press. Pending field events are never judged in the cloud later (spec says they should be). | `DeadzoneField.kt`, `MainActivity.kt` | Create the scope in `start()`; move Firebase/App Check init to an `Application` class; on reconnect, judge `judgedBy == pending` events with the cloud model and update them. |
| P1-10 | FreshCart fixed build talks to Firestore without App Check, so it breaks as soon as App Check enforcement is turned on for Firestore. | `apps/freshcart/src/orders.ts` | Initialise App Check (reCAPTCHA Enterprise with the FreshCart domains added to the key) through the shared `initFirebase`. |
| P1-11 | Console creates its workspace with a hard-coded `targetUrl: 'http://localhost:5175'` and name "FreshCart team"; dashboard sorting uses `startedAt` for every collection. | `apps/console/src/main.ts` | Onboarding form for name and target URL; sort each collection by its own timestamp (`createdAt` for findings and field events). |

## P2: Code standards (what makes it look like a toy)

| # | Problem | Fix |
|---|---|---|
| P2-1 | Almost all code is written as dense single lines (e.g. `panel.js`, `console/main.ts`, `firestore.rules`), which is unreadable and unreviewable. | Add Prettier + ESLint (typescript-eslint, plugin for Chrome extension globals), format the whole repo, enforce in CI. Break large functions into modules. |
| P2-2 | Cross-package path hacks: scripts run `apps/spike/node_modules/vite/...` and `packages/shared/node_modules/typescript/...`; the extension's `vite.config.mjs` imports Vite from the spike; `panel.js` imports Firebase from `packages/shared/node_modules/...`. The extension has no `package.json`. | Give every app its own `package.json` with `vite`, `typescript`, `firebase` deps and `dev/build/test` scripts; import `@deadzone/shared` by name; root scripts become `pnpm -r build`, `pnpm -r typecheck`, `pnpm --filter … dev`. |
| P2-3 | Extension is plain JavaScript (`panel.js`, `background.js`, `integration.mjs`) with no type checking, while the rest is TypeScript. | Convert to TypeScript (`panel.ts`, `background.ts`, `integration.ts`) under `apps/extension/src`, using `@types/chrome`; use `@crxjs/vite-plugin` or keep the custom copy plugin. |
| P2-4 | Root `tsconfig.json` has no `include`, so `tsc` scans the whole folder tree (including temp folders), and each app isn't checked with its own settings. | Project references: `tsconfig.base.json` + one `tsconfig.json` per package with explicit `include`. |
| P2-5 | The Phase 0 `spike` app is still the default `pnpm dev` target and part of the build. | Move it to `tools/spike` (or delete) and point `pnpm dev` at the extension + FreshCart. |
| P2-6 | Version and docs drift: README says pnpm 10, `packageManager` says pnpm 11.25.0; extension version `0.0.1`; no icons in the manifest. | One Node/pnpm version in `package.json` `engines` + `.nvmrc`; semantic versions; add 16/32/48/128 px icons. |
| P2-7 | Unit tests transpile files by hand into `.test-build`; only `audit.ts` is covered. | Use Vitest for `packages/shared` (audit, config bounds, sync counts) and the extension's pure functions (`validatePlan`, `expectedFields`). |
| P2-8 | `docs/build-status.md` is a running log mixed with claims. | Replace with `CHANGELOG.md` + a short `docs/STATUS.md` of what is verified vs not. |

## P3: Product gaps against the build spec

| # | Gap | Fix |
|---|---|---|
| P3-1 | Extension UI is one scrolling page of buttons; the spec's six screens (Setup, Plan, Live sweep, Results, Finding detail, Settings), header status chips, severity colours, ON DEVICE/CLOUD/PENDING badges and before/after slider are missing. This hurts the **Design** score most. | Build the side panel as a small React (or Lit) app with those six screens, following spec §11.2 and the design tokens in §11.1. |
| P3-2 | No visible sync counter in its own place, no network ONLINE/OFFLINE indicator, no Nano status chip (only the status line). | Header with live `navigator.onLine`, model availability and "N waiting to sync". |
| P3-3 | Console: no trend chart, no QR pairing, no filters, no coverage percentages, no field-event thumbnails, and the `/preview` page shows hard-coded example results (clearly labelled, but judges may still see it as fake). | Add the chart, QR, filters and coverage maths from spec §11.3; keep `/preview` but link it as "Example data" only. |
| P3-4 | Only one network profile per sweep (a checkbox), not offline **and** flaky per action. | Run each action under each selected profile; store `profileId` per check (already supported in the data). |
| P3-5 | Android: no FreshCart Compose app, no field overlay chip, no field log, no QR pairing, no `devices/{id}` coverage reporting. | Build per spec §10.4 and §11.4, or narrow scope honestly in the README to "Field SDK demo app". |
| P3-6 | No "Model download" flow with progress in a proper UI, no `availability()` check before sweeps. | Check model availability on panel open; block the sweep with a clear message if unavailable, or warn that verdicts will be pending. |

## P4: Production hardening

| # | Problem | Fix |
|---|---|---|
| P4-1 | Pairing codes are 6 digits with no expiry or attempt limit; any anonymous user who knows a workspace ID can brute-force 1,000,000 codes by retrying updates. | Pair through a callable Cloud Function with rate limiting and code expiry (10 minutes), or use 12-character random codes plus `pairingExpiresAt` checked in rules. |
| P4-2 | Members can write anything to `runs`, `checks`, `findings`, `fieldEvents` (no schema or size checks in rules). | Validate keys, types, enum values and `thumb*` sizes (≤ 160 KB base64) in rules; add emulator tests. |
| P4-3 | The extension build bakes `VITE_APP_CHECK_DEBUG=true` into the ZIP. Fine for judging (debug tokens are allowed), but not shippable. | Document it as a judging build; for production, add a custom App Check provider backed by a Cloud Function, and never publish debug builds. |
| P4-4 | No error reporting or telemetry for failures in the field. | Log errors to a `diagnostics` collection (no PII) or Crashlytics on Android. |
| P4-5 | FreshCart orders: anonymous users can create unlimited orders. | Acceptable for a demo; add App Check enforcement and a per-user rate rule if kept public. |
| P4-6 | Bundle-size warning from Vite on the console build. | Code-split Firebase modules; lazy-load the preview page. |

---

## Order of work (suggested)

1. **Day 1 – unblock:** P0-1 … P0-6, P1-1, P1-2, P2-2, P2-1 (format once, then everything after is reviewable).
2. **Day 2 – correctness:** P1-3 … P1-11, P2-3, P2-4, P2-7, CI updated.
3. **Day 3 – product polish:** P3-1, P3-2, P3-3 (Design score), P0-7 README.
4. **Day 4 – Android:** P0-8, P1-9, P3-5.
5. **Day 5 – hardening and release:** P4-1, P4-2, P3-4, P3-6, tag `v1.0.0`, GitHub Release with extension ZIP + APK, record video from the real build.
