# Personal project migration

Destination requested: `work-511514`.
Source: `fbailogic26vrt-3003`, assigned temporary account.
Local work and migration backups stay under `F:\DEADZONE`.

## Prepared

- Inventory: three Hosting targets, Firestore rules/indexes, Authentication, Firebase AI Logic, App Check, Remote Config, and client configuration for console/extension/FreshCart/spike.
- Source backup is in ignored `tmp/private/migration/fbailogic26vrt-3003/`. This contains private account/data exports and must not be committed or published.
- Personal CLI configuration is isolated in `.local-tools/personal-cloud-config` on F:.
- Personal login verified for `nandavarshithareddy@gmail.com`; access to `work-511514` is confirmed.
- Destination billing is enabled and its existing default Firestore database is in `asia-south1`.

## Relay cleanup (2026-11-25)

The user authorized removal of Relay, including the 22 untagged anonymous accounts and `adk_check_demo`. Removed all 25 existing Auth accounts and 70 Firestore documents across five collections, three Relay Cloud Run services, the scheduled sweep, two Pub/Sub topics, four Relay buckets, the Relay Artifact Registry repository, the Relay Firebase web app, and six Relay service accounts and their project IAM bindings. Removed six old Hosting versions, eleven Relay indexes, and the Relay preview authorized domain. Hosting was disabled before deleting its old versions.

Verification confirmed zero Auth users and no remaining Firestore collections. The unrelated `vyaparsetu-demo` and `post-code-sci-governor` services remain, along with their shared build resources and the Vyaparsetu invoice bucket. Private snapshots and deletion results remain under `tmp/private/migration/work-511514/` on F:. Platform audit history, provider retention, and recoverable deleted resources are not a promise of irreversible erasure.

## Migration sequence

1. Authenticate the personal account and verify access to the exact destination project.
2. Inspect destination resources and existing data before creating or importing anything. Confirm region for a new database and any required billing changes before applying them.
3. Register appropriate Firebase web clients; configure Google/anonymous Authentication, authorized domains, Firebase AI Logic and App Check. Recreate destination-specific keys/tokens rather than reusing temporary credentials.
4. Preserve exported Authentication user IDs when importing users, or explicitly remap Firestore workspace ownership/membership. Do not import old project IAM memberships into the personal project.
5. Import the backed-up Firestore data and deploy rules/indexes; restore compatible Remote Config settings.
6. Create destination Hosting sites without overwriting unrelated deployments. Update `.firebaserc`, each application's ignored environment file, extension site permissions and all active app links.
7. Build and deploy the console and both FreshCart variants; rebuild the extension against the new Firebase project. Update documentation and download links.
8. Verify sign-in, pairing, Firestore sync, Nano/offline behavior, cloud fallback, and buggy/fixed checkout on destination URLs.
9. Keep the old project intact until destination acceptance succeeds. Do not delete or transfer the assigned temporary project without separate authorization and organizational permission.

Android source is registered as `com.deadzone.freshcart` in the destination and its ignored `android/app/google-services.json` has been replaced. No Android APK build, phone validation, or store release was performed.

## Deployed and verified (2026-11-25)

- Console: https://work-511514.web.app
- FreshCart buggy: https://dz-work-511514-buggy.web.app
- FreshCart fixed: https://dz-work-511514-fixed.web.app
- Rebuilt extension download: https://work-511514.web.app/downloads/deadzone-extension-0.2.0.zip
- Google and anonymous sign-in are enabled. Live Google popup sign-in with the personal account opened the migrated dashboard successfully.
- Two source workspaces were imported with ownership assigned to the personal Google identity. Old members and pairing codes were not carried over; generate a new pairing code in console Settings.
- `.firebaserc`, all five local environment files, active app links, hosted test URLs, and the extension allowlist now use the personal project.
- Firestore rules/indexes deployed. New reCAPTCHA Enterprise App Check configuration belongs to the destination project. Source Remote Config was empty, so existing application defaults apply.
- All app typechecks and builds passed. Audit unit checks and extension runtime checks passed. All 20 FreshCart browser tests passed against the hosted sites, including mid-order connection loss and recovery.
- Actual extension paired with a temporary live workspace, captured checkout offline, and made zero cloud AI requests during the local sweep. Temporary verification workspace and App Check token are removed after verification.
- **Cloud diagnosis remains pending at the user's request.** Firebase AI Logic and Gemini Developer API are enabled, and the Firebase AI Logic service agent has the required Service Usage Consumer role. The Gemini request reaches the provider but returns HTTP 429: prepayment credits depleted. No payment settings or alternative paid provider were enabled. Resolve billing in https://ai.studio/projects for `work-511514`, then repeat cloud diagnosis and server-sync verification.
- The source temporary project was not deleted. Unrelated destination applications and shared infrastructure were preserved.

## Personal CLI commands

```powershell
Set-Location F:\DEADZONE
. ./scripts/personal-cloud-env.ps1
node node_modules/firebase-tools/lib/bin/firebase.js login --no-localhost
```

The default deployment target is now `work-511514`. Use the personal-cloud environment helper above so the CLI selects the personal login stored on F:. Web deployment is complete; cloud diagnosis acceptance remains pending billing, and Android remains source/configuration only.
