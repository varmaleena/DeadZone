# End-to-end verification — 23 November 2026

## Verified on this laptop

- Firebase AI Logic initialized Chrome's local model from the dedicated F: profile.
- A real FreshCart screenshot was evaluated through `ONLY_ON_DEVICE` with the browser context offline throughout inference. `navigator.onLine` was false at completion, and no network responses occurred during inference.
- The genuine MV3 extension completed its five-screen sweep using local model calls. Results survived a panel reload, and the target's network recovered after the sweep.
- The separate no-Nano test captured a real offline checkout failure. The corrected local-only adapter made **zero cloud AI requests** during that sweep and left the check pending.
- After explicit cloud diagnosis, Gemini returned a high-severity checkout finding. No source files were uploaded in this test.
- Live anonymous pairing, device reporting, run/check/finding writes and synchronization were confirmed from server-side Firestore records. The run was complete, the checkout check was judged by cloud, and one finding and one device record existed.
- All 24 FreshCart/integration browser tests passed, including checkout processing, reconnect, order confirmation, responsive layouts and an unrelated notes application.
- Shared audit regression tests and all package type checks passed. Changed TypeScript/test files passed ESLint.

## Issues found and corrected

1. A model labelled the readable cart screen blank. Blank-screen verdicts that contradict at least 40 characters of measured visible content now remain pending for review. A real cart recheck confirmed that deferral; it was not silently turned into a pass.
2. Measured long-running spinners now override conflicting model labels, with lost form fields retaining priority.
3. In a browser without the local API, the SDK attempted its default cloud model from the local-only model wrapper. The extension now checks actual device readiness before invoking that wrapper. The corrected no-Nano sweep made zero cloud AI requests.
4. Cloud diagnosis can no longer report completion while checks remain pending.
5. Anonymous sign-in was disabled. It was enabled with the user's explicit approval. Workspace security rules were unchanged.

## Evidence on F:

- `output/nano-check/offline-test.json` and `firebase-runtime-test.png`
- `output/extension-e2e/sweep.json` and `results.png` (original five-check run)
- `output/extension-cart-recheck/sweep.json` (post-fix contradictory verdict safely deferred)
- `output/extension-cloud-e2e/diagnosis.json`, `diagnosis.png`, and `server-verification.json`

## Limits

Model inference is real, but model accuracy is not guaranteed; contradictory evidence must remain reviewable. The broker identified `nano_v3_gpu_low_tier_model`; these tests do not establish Nano 4 execution. Source-linked patch generation was not tested because automatic approval review rejected source export without specific authorization. The Android app remains unbuilt/unverified and is outside this web-extension test.

Temporary cloud workspace records were removed and the temporary App Check debug token revoked after verification. Anonymous sign-in remains enabled as approved. The main hosted console and published extension archive were not redeployed or replaced by these local tests.

Use `scripts/open-nano-chrome.ps1` to reopen the verified F: profile. Keep that profile and its model files; a fresh browser profile will not inherit the downloaded model automatically.
