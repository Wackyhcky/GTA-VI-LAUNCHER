# Build the portable exe, stamp the version resource, then apply the
# self-signed novelty code signature.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"
$rcedit = Join-Path $root "node_modules\electron-winstaller\vendor\rcedit.exe"
$pfx = Join-Path $root "signing\rockstar-novelty.pfx"
$exe = Join-Path $root "dist\game_scarlett_master.exe"
$copyright = [string][char]0x00A9

Write-Host "==> Building portable exe..." -ForegroundColor Cyan
npm run dist

if (-not (Test-Path $exe)) { throw "Build output not found: $exe" }

Write-Host "==> Stamping version resource..." -ForegroundColor Cyan
# NOTE: do not rcedit the portable wrapper -- it drops the appended NSIS payload.
# electron-builder already writes CompanyName / ProductName / LegalCopyright from package.json.

if (Test-Path $pfx) {
  Write-Host "==> Signing $exe" -ForegroundColor Cyan
  & $signtool sign /fd SHA256 /f $pfx /p "scarlett" /d "Grand Theft Auto VI" /du "https://www.rockstargames.com/" $exe
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
} | Format-List
