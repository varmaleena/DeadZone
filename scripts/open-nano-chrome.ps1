. "$PSScriptRoot/f-drive-env.ps1"
$browserPath = 'C:\Users\leeva\AppData\Local\Google\Chrome\Application\chrome.exe'
$profilePath = Join-Path (Split-Path $PSScriptRoot -Parent) '.local-tools\nano-offline-test-profile'
New-Item -ItemType Directory -Path $profilePath -Force | Out-Null
Start-Process -FilePath $browserPath -ArgumentList @("--user-data-dir=$profilePath", '--enable-features=AIPromptAPI,AIPromptAPIMultimodalInput', 'http://127.0.0.1:5174/')
