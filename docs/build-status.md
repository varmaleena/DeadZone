# Build status

Phase 0 in progress.

Verified: dependencies downloaded; strict TypeScript check passes; Vite production build passes (bundle-size warning remains).

Implemented: shared Firebase/App Check/Firestore initialization, validated verdict contract, image-and-text ONLY_ON_DEVICE web spike, Firebase Hosting and emulator configuration, Remote Config defaults, deny-by-default workspace security rules, CI build workflow.

Security: only owners can manage workspace membership for now. Pairing joins remain disabled until rules and emulator tests are implemented. Production builds do not enable App Check debug mode.

Android Phase 0 scaffold added with synthetic Bitmap fixture and ONLY_ON_DEVICE inference; see android/README.md. Local checks now run through node scripts/check.mjs --build, avoiding the pnpm sandbox wrapper.

Not verified: real App Check attestation, Nano offline inference, Android compilation and device inference. No Firebase resources deployed. Hosting paths for later apps are configuration only; those apps are not implemented yet.

Phase 0 acceptance is pending real device tests and Firebase setup. Later phases are not complete.

## Additional implementation (acceptance pending)

FreshCart five-route buggy/fixed web variants implemented and built. Fixed checkout is a local queue only, not Firestore sync. Extension development scaffold implements debugger network switching, route actions, DOM signals, local storage, cancellation, panel-disconnect cleanup and JSON export. All extension results remain pending; model integration, screenshots and cloud diagnosis are not complete. Android remains uncompiled. Console is not implemented.

## Firebase provisioning

Project fbailogic26vrt-3003 is accessible in Firebase. Web app deadzone-console registered. Gemini API setup completed in console. App Check provider registered successfully (Fraud Defense / reCAPTCHA Enterprise), domain restricted to fbailogic26vrt-3003.web.app. Local spike environment populated; development debug token registration and real inference remain outstanding.

App Check development token registered and verified through a real getToken(appCheck, true) request on the local spike. No token value is stored in source. Browser device preparation returned AI/api-not-enabled (LanguageModel API unavailable); actual Nano inference remains unverified.

Shared audit pipeline added: schema validation, form-loss/spinner overrides, pending on model failure, no score while checks pending, baseline regression matching, cloud diagnosis parsing and unknown-check rejection, 60 KB source cap. ONLY_IN_CLOUD model configured. Deterministic audit checks pass; strict compilation and all web variant builds pass. Shared pipeline is not yet wired into the extension UI; real cloud diagnosis remains untested.

## Console implementation

Console added: Google login, workspace discovery/creation, Firestore live run lists and reports, findings/detail/status/copy patch, field records, device coverage list, settings/code rotation, loading/empty/error paths. Built successfully; live authenticated acceptance not run. This is a TypeScript UI rather than the specified React stack; trend chart, QR pairing and filters remain missing. Shared Firestore run/check writes, pending observer and passing-baseline transaction added; extension integration outstanding.

## Extension integration

Bundled MV3 extension now imports shared Firebase and audit code. Added CDP screenshots, online/offline image composition, capped thumbnails, measured-threshold DOM signals, on-device judging, Firestore queue writes and pending count, manual post-sweep cloud fallback and diagnosis, findings persistence, passing baseline save and regression flags. Added debugger command timeouts and disconnect rejection. Extension bundle builds, but Chrome runtime acceptance has not been performed. Missing capabilities are listed in apps/extension/README.md. No full-product completion is claimed.

Pairing client and additive membership rules implemented locally (emulator tests/deployment pending). Remote Config timeout, settle and max-check settings wired to extension with bounded defaults. Source-folder selection lists eligible route/lib source paths, limits content size and requires explicit opt-in before diagnosis transmission. Fixed judged-by badges and passed rubric timeout into verdict postprocessing.

## Android Field SDK

Added :deadzone-field library source and paired capture controls in the spike Activity. SDK watches validated connectivity, captures the bound window after settle, validates on-device verdict JSON and writes queued field events to Firestore. Anonymous pairing uses the shared membership rule contract. Android sources remain uncompiled: SDK/Gradle/device unavailable. Full FreshCart Compose screens, field-log UI, QR scan, cloud fallback and coverage reporting remain incomplete.

## Security and checkout stage

Emulator verified workspace isolation, pairing constraints, order-owner isolation and offline pending writes syncing after reconnect. Nested workspace rule fixed. Fixed FreshCart checkout retains addresses and a durable local queue, then submits stable-ID orders via anonymous Auth and persistent Firestore. Identical retries permitted; edits denied. Production rules not deployed. Browser UX acceptance remains pending.

## FreshCart browser acceptance stage

Playwright Chromium: 10/10 checks passed across buggy and fixed builds. Covered Home offline cached-content/spinner behavior, Cart control, Profile raw-error/friendly-card behavior, Orders blank/cache behavior, and Checkout input loss versus preserved fields/local queue. Fixed fields remained populated after reconnect. These tests use browser-context network loss on a previously loaded app shell; they do not prove whole-machine airplane-mode operation, extension integration, Nano quality, or live Firebase order acknowledgement. CI now runs browser and Firestore emulator checks.

## Hosting deployment

Firebase CLI deployed console to https://fbailogic26vrt-3003.web.app and FreshCart variants to https://dz-3003-buggy.web.app and https://dz-3003-fixed.web.app. Hosting targets mapped; extension host permissions include both demos. Hosted Playwright verification blocked by ERR_INTERNET_DISCONNECTED before page load; not an acceptance pass. Firestore API activation requested with assigned Firebase CLI account. Default database creation awaiting explicit approval of asia-south1 after automatic approval review rejected the persistent regional database change.

Correction: the already-running firebase deploy --only firestore automatically created the default database and successfully deployed tested rules/indexes. Metadata confirms STANDARD/FIRESTORE_NATIVE, location nam5, freeTier true. The separate explicit asia-south1 creation was rejected and was not executed. No further database creation is required.

## Sweep controls and package

Added editable JSON actions with bounded plan size, navigation/click/fill/submit/wait execution and selector timeout; flaky profile (3s latency then offline drop); reconnect pending retry without source transmission; screenshot pairs and regression badges; Copy patch. Built extension ZIP at output/release/deadzone-extension.zip. Package is development-only and not a verified release. Build and audit checks pass; extension/Nano runtime, Android and hosted integrated acceptance remain pending. Demo storyboard drafted, video not recorded.

## Reusable web integration

Removed FreshCart domain allowlist from target selection; added optional HTTP/HTTPS origin permission requests, same-origin plan validation, unique action IDs, native input setters for controlled forms, generic snapshots and expected-field comparisons. Four Chromium integration checks pass on an unrelated notes form: safe target/plan validation, lost input, retained input, hidden spinner. Extension bundle builds. Runtime Chrome permission/debugger acceptance, real Nano/cloud judging and Android compilation remain unverified.

## Functional cart correction

Replaced cosmetic Add button and fixed basket with persistent product quantities, increase/decrease/remove controls and calculated totals. Checkout uses the actual basket total and queued orders retain item snapshots, synced into Firestore under owner-private rules. Orders view renders actual local order records instead of a canned past order. Thirteen FreshCart browser checks passed, then four affected cart/orders checks passed after history changes. Firestore rules/offline sync tests pass. Actual MV3 runtime test also passed attach, offline emulation, screenshot and disconnect restoration in isolated Chromium. Android and Nano remain unverified.
