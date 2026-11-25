# Development on F:

The project is restored to `F:\DEADZONE`. Dependencies, package downloads, browser binaries, temporary files and build output are kept on F:.

Before installing or running development commands in a new PowerShell terminal:

```powershell
Set-Location F:\DEADZONE
. ./scripts/f-drive-env.ps1
pnpm install --frozen-lockfile
pnpm --filter @deadzone/console dev
```

The environment script redirects npm/pnpm caches, Playwright browsers, pip cache, Gradle cache and temporary files to `.local-tools` on F:. Existing system Node, Git and PowerShell executables are reused; no new system-wide installation is required. Windows and Codex may still maintain their own operating-system and application data on C:.

The console's public Firebase configuration is in ignored `apps/console/.env.local`. These values configure the existing project; they do not replace authentication or App Check authorization. No CLI account tokens were restored.

To build and inspect the console:

```powershell
. ./scripts/f-drive-env.ps1
pnpm --filter @deadzone/console build
node apps/console/node_modules/vite/bin/vite.js preview apps/console --host 127.0.0.1 --port 5191
```

Open `http://127.0.0.1:5191/` for the homepage or `/preview` for the read-only workspace. Signed-in workspace pages require Google sign-in and an existing workspace. Preview results remain explicitly identified as examples.
