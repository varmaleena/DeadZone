# Dot-source before installing or running this project's tools:
# . ./scripts/f-drive-env.ps1
$projectPath = Split-Path $PSScriptRoot -Parent
$toolsPath = Join-Path $projectPath '.local-tools'
foreach ($folder in @('temp', 'npm-cache', 'pnpm-cache', 'pnpm-store', 'pnpm-state', 'browsers', 'gradle', 'pip-cache', 'xdg-cache', 'corepack')) {
    New-Item -ItemType Directory -Path (Join-Path $toolsPath $folder) -Force | Out-Null
}
$env:TEMP = Join-Path $toolsPath 'temp'
$env:TMP = $env:TEMP
$env:npm_config_cache = Join-Path $toolsPath 'npm-cache'
$env:PNPM_HOME = Join-Path $toolsPath 'pnpm'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $toolsPath 'browsers'
$env:GRADLE_USER_HOME = Join-Path $toolsPath 'gradle'
$env:PIP_CACHE_DIR = Join-Path $toolsPath 'pip-cache'
$env:XDG_CACHE_HOME = Join-Path $toolsPath 'xdg-cache'
$env:COREPACK_HOME = Join-Path $toolsPath 'corepack'
