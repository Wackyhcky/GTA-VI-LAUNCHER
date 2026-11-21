# Build the portable exe, then apply the self-signed novelty code signature.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"
$pfx = Join-Path $root "signing\scarlett-novelty.pfx"
$exe = Join-Path $root "dist\game_scarlett_master.exe"

Write-Host "==> Building portable exe..." -ForegroundColor Cyan
npm run dist

if (-not (Test-Path $exe)) { throw "Build output not found: $exe" }

Write-Host "==> Stamping version resource..." -ForegroundColor Cyan
# NOTE: do not rcedit the portable wrapper -- it drops the appended NSIS payload.
# electron-builder already writes CompanyName / ProductName / LegalCopyright from package.json.

if (Test-Path $pfx) {
  Write-Host "==> Signing $exe" -ForegroundColor Cyan
  & $signtool sign /fd SHA256 /f $pfx /p "scarlett" /d "Scarlett Launcher" /du "https://example.invalid/" $exe
} else {
  Write-Host "!! No pfx found, skipping signature. Run scripts\make-cert.ps1 first." -ForegroundColor Yellow
}

Write-Host "==> Done: $exe" -ForegroundColor Green
$v = (Get-Item $exe).VersionInfo
[pscustomobject]@{
  Name             = (Get-Item $exe).Name
  MB               = [math]::Round((Get-Item $exe).Length / 1MB, 1)
  CompanyName      = $v.CompanyName
  ProductName      = $v.ProductName
  FileVersion      = $v.FileVersion
  LegalCopyright   = $v.LegalCopyright
  LegalTrademarks  = $v.LegalTrademarks
} | Format-List
