# Integrating an unrelated web app

1. Build the extension and load apps/extension/dist in desktop Chrome.
2. Open the app you own or are authorized to test. Sign in normally before auditing.
3. Open Deadzone and replace the sweep plan with your routes and CSS selectors.
4. Start sweep and accept Chrome’s request for the selected site origin.
5. Prepare Nano using its button before offline judging. Unsupported clients retain pending results; cloud diagnosis is a separate reconnect operation.

Example plan for a notes app:

```json
[{"id":"save-note","label":"Save field note","route":"/notes","rootSelector":"main","steps":[{"type":"fill","selector":"[name=note]","value":"Inspection complete"},{"type":"submit","selector":"button[type=submit]"}]}]
```

Input-loss detection uses non-empty fill steps rather than any app-specific field ID. Native input setters trigger input/change events for controlled UI frameworks. Actions navigate within the selected origin; cross-origin routes and duplicate IDs are rejected. SPA navigate steps dispatch popstate; use explicit click actions to trigger the target app’s actual navigation when required. Sites with full document navigation require a loaded/cached app shell to work offline.

Limits: closed shadow DOM, cross-origin frames, browser internal pages and extension pages are not supported. Each action may submit real data: use an isolated test account and fictional fixture data. Screenshots and DOM summaries can contain app data; local capture and cloud diagnosis should be used only with authorized data. Chrome permission/capture/debugger behavior still requires real-extension runtime acceptance; browser runner tests do not prove Nano or cloud quality.
