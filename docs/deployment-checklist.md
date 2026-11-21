# Deployment readiness

Local builds, audit logic checks, Firestore emulator security/offline-write tests and ten FreshCart browser checks pass.

Before deployment:
- Authenticate Firebase CLI as the assigned hackathon account; verify project fbailogic26vrt-3003.
- Enable Firestore and Anonymous/Google Auth and configure authorized hosting domains.
- Register separate app configuration and App Check tokens for each client.
- Review and deploy firestore.rules and indexes after emulator checks.
- Create and map Hosting targets console, freshcart-buggy and freshcart-fixed. Current target aliases are not yet mapped.
- Build with local project environment; ensure App Check debug mode is excluded from public hosted release builds.
- Verify both hosted FreshCart variants, console sign-in, extension sync, and Android event sync.

Do not claim submission-ready until Chrome extension, Nano and Android device acceptance pass. No production deployment was performed in the browser acceptance stage.
