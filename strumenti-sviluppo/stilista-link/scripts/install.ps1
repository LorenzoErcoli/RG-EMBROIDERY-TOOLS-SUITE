# Installazione di sviluppo: il plugin appena compilato, con la suite del server locale (npm run dev, 5270).
# Stessa strada del pacchetto per chi lo prova (pacchetto\installa.ps1), cambia solo l'indirizzo.
# (Solo ASCII qui: PowerShell 5 legge gli script senza BOM come ANSI.)
param(
    [string]$StilistaInstallDir = "C:\GMI\Stilista3.3",
    [string]$Indirizzo = "http://localhost:5270/?stilista={0}#/"
)

$ErrorActionPreference = "Stop"
$sorgente = Join-Path $PSScriptRoot "..\bin\Release\net48\StilistaLink.exe"
if (-not (Test-Path -LiteralPath $sorgente)) {
    throw "Plugin non compilato: eseguire prima scripts\build.ps1."
}
& (Join-Path $PSScriptRoot "..\pacchetto\installa.ps1") -Stilista $StilistaInstallDir -Indirizzo $Indirizzo -Plugin (Resolve-Path $sorgente).Path
