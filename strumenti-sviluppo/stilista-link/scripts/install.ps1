# Copia il plugin in PLUG-INS\RGStilistaLink\<data-ora>\ e fa puntare pluginlist.txt li' (con backup).
# Una cartella per installazione: l'eseguibile di prima resta bloccato dagli Stilista aperti, e loro
# continuano con quello; le finestre aperte dopo caricano il nuovo. Gli altri plugin restano.
# (Solo ASCII qui: PowerShell 5 legge gli script senza BOM come ANSI.)
param(
    [string]$StilistaInstallDir = "C:\GMI\Stilista3.3"
)

$ErrorActionPreference = "Stop"
$sorgente = Join-Path $PSScriptRoot "..\bin\Release\net48\StilistaLink.exe"
$radice = Join-Path $StilistaInstallDir "PLUG-INS\RGStilistaLink"
$cartella = Join-Path $radice (Get-Date -Format "yyyyMMdd-HHmmss")
$lista = Join-Path $StilistaInstallDir "PLUG-INS\pluginlist.txt"
$installato = Join-Path $cartella "StilistaLink.exe"

if (-not (Test-Path -LiteralPath $sorgente)) {
    throw "Plugin non compilato: eseguire prima scripts\build.ps1."
}
if (-not (Test-Path -LiteralPath $lista)) {
    throw "pluginlist.txt non trovato: $lista"
}

New-Item -ItemType Directory -Force -Path $cartella | Out-Null
Copy-Item -LiteralPath $sorgente -Destination $installato -Force

$righe = @(Get-Content -LiteralPath $lista | Where-Object {
    -not [string]::IsNullOrWhiteSpace($_) -and
    -not $_.StartsWith($radice, [StringComparison]::OrdinalIgnoreCase)
})
$backup = "$lista.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
Copy-Item -LiteralPath $lista -Destination $backup
Set-Content -LiteralPath $lista -Value ($righe + $installato)
Write-Host "Installato: $installato (pluginlist aggiornato, backup: $backup)"
Write-Host "Le finestre di Stilista aperte da ora caricano questa versione."
