param(
    [ValidateSet('web', 'android', 'lan')]
    [string]$Platform = 'web',
    [int]$Port = 8081
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$portableNode = Join-Path $PSScriptRoot '.tools\node-v22.14.0-win-x64'
if (Test-Path (Join-Path $portableNode 'node.exe')) {
    $env:Path = "$portableNode;$env:Path"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Install Node.js 22.14 or later, then run this script again.'
}
if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules\expo'))) {
    throw 'Dependencies are missing. Run npm ci with Node.js on PATH first.'
}
$env:EXPO_NO_TELEMETRY = '1'
if ($Platform -eq 'lan') {
    & npx.cmd expo start --lan --port $Port
} else {
    & npx.cmd expo start "--$Platform" --port $Port
}
exit $LASTEXITCODE
