# Deadzone Chrome extension

Manifest V3 side-panel extension that sweeps a web app under offline and flaky network profiles, judges each screen with on-device Gemini Nano, and diagnoses failures with cloud Gemini after reconnecting.

## Build and load

```
pnpm install
pnpm --filter @deadzone/extension build      # or: node scripts/check.mjs --build
```

Copy `.env.example` (repo root) to `apps/extension/.env.local` and fill in the Firebase web config first. Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and choose `apps/extension/dist`.

This judging build enables the App Check debug provider (`VITE_APP_CHECK_DEBUG=true`): open the side panel's DevTools console, copy the debug token and register it in Firebase console → App Check → Manage debug tokens. Never publish a debug build to the Chrome Web Store.

## Using it

1. **Setup** – download the on-device model if Chrome offers it, optionally pair with a workspace (ID + 8-character code from the console), and open your app in the active tab.
2. **Sweep** – review the user actions (edit the plan JSON for your own app), choose Offline and/or Flaky, and click **Start sweep**. Each action is loaded online, then repeated with the network cut; the screen is judged on-device and the check card appears with an ON DEVICE / PENDING badge.
3. **Results** – see the offline score, then **Diagnose in cloud** (online) to judge pending checks and group failures into findings. Link your source folder first to get a code diff. A fully passing run can be saved as the baseline.
4. **Finding detail** – before/after slider, root cause, fix diff with **Copy patch**, and **Explain in plain words** (runs on-device when Nano is available, otherwise in the cloud).

## Code layout

| File | Role |
|---|---|
| `src/background.ts` | Service worker; owns `chrome.debugger`, applies network profiles, captures screenshots, always restores the network |
| `src/integration.ts` | Plan validation and the functions injected into the page (actions, snapshots) |
| `src/panel/main.ts` | Side-panel app: sweep, judging, diagnosis, baseline, settings |
| `src/panel/images.ts`, `sources.ts`, `dom.ts` | Thumbnails, source linking, DOM helpers |
| `src/plans/freshcart.json` | Default sweep plan for the FreshCart demo |

See [docs/web-integration.md](../../docs/web-integration.md) for testing your own app.
