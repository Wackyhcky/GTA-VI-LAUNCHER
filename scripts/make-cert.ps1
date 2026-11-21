# Creates a self-signed code-signing certificate for the novelty build.
# Windows will report the signature as untrusted unless this cert is manually
# installed into the Trusted Root store -- which this script does NOT do.
param(
  [string]$Subject = "CN=Scarlett Novelty Works",
  [string]$OutFile = "signing\scarlett-novelty.pfx",
  [string]$Password = "scarlett"
)

$ErrorActionPreference = "Stop"
$dir = Split-Path -Parent $OutFile
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $Subject `
  -FriendlyName "Scarlett Novelty Works (unofficial fan project)" `
  -KeyUsage DigitalSignature `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(5) `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3")

$pwd = ConvertTo-SecureString -String $Password -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $OutFile -Password $pwd | Out-Null

Write-Output "Subject:    $($cert.Subject)"
Write-Output "Thumbprint: $($cert.Thumbprint)"
Write-Output "PFX:        $((Resolve-Path $OutFile).Path)"
