param(
  [int]$port = 9223,
  [string]$profile = ''
)
$ErrorActionPreference = 'Stop'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
if (-not (Test-Path $edge)) { Write-Error 'msedge.exe not found'; exit 1 }

if (-not $profile) {
  $profile = Join-Path (Split-Path -Parent $PSScriptRoot) '.edge-profile'
}
New-Item -ItemType Directory -Force -Path $profile | Out-Null

# 已经在跑就直接复用
try {
  $v = Invoke-RestMethod "http://127.0.0.1:$port/json/version" -TimeoutSec 1
  Write-Output "CDP already ready: $($v.Browser)"
  exit 0
} catch { }

$args = @(
  '--headless=new',
  "--remote-debugging-port=$port",
  "--user-data-dir=$profile",
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1600,1000',
  'about:blank'
)
Start-Process -FilePath $edge -ArgumentList $args -WindowStyle Hidden | Out-Null

for ($i = 0; $i -lt 48; $i++) {
  try {
    $v = Invoke-RestMethod "http://127.0.0.1:$port/json/version" -TimeoutSec 1
    Write-Output "CDP ready: $($v.Browser)"
    exit 0
  } catch {
    Start-Sleep -Milliseconds 250
  }
}
Write-Error 'CDP endpoint not ready'
exit 1
