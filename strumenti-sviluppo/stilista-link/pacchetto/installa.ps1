# RG Stilista Link - installazione.
# Copia il plugin in <Stilista>\PLUG-INS\RGStilistaLink\<data-ora>\ e aggiunge la sua riga a pluginlist.txt
# (gli altri plugin restano). La copia di sicurezza di pluginlist.txt va in RGStilistaLink\backup\, cosi'
# la disinstallazione non lascia niente in giro. Una cartella per installazione: uno Stilista aperto (anche
# solo coi suoi processi di riserva) tiene la versione di prima, finche' non lo si chiude del tutto; le
# versioni vecchie si cancellano solo a Stilista chiuso.
# (Solo ASCII qui: PowerShell 5 legge gli script senza BOM come ANSI.)
param(
    [string]$Stilista = "",   # la cartella di Stilista (quella con bin\ e PLUG-INS\); vuota = la cerca
    [string]$Indirizzo = "",  # l'indirizzo della suite; vuoto = quello di indirizzo.txt accanto allo script
    [string]$Plugin = ""      # StilistaLink.exe; vuoto = quello accanto allo script
)
$ErrorActionPreference = "Stop"
$qui = $PSScriptRoot

function Cartelle-Stilista {
    $trovate = @()
    foreach ($p in Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like 'Stilista*' }) {
        try { if ($p.Path) { $trovate += (Split-Path (Split-Path $p.Path -Parent) -Parent) } } catch {}
    }
    $trovate += "C:\GMI\Stilista3.3"
    if (Test-Path "C:\GMI") { $trovate += (Get-ChildItem "C:\GMI" -Directory | ForEach-Object FullName) }
    foreach ($pf in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if ($pf -and (Test-Path "$pf\GMI")) { $trovate += (Get-ChildItem "$pf\GMI" -Directory | ForEach-Object FullName) }
    }
    $trovate | Select-Object -Unique | Where-Object {
        (Test-Path (Join-Path $_ "PLUG-INS\pluginlist.txt")) -and (Get-ChildItem (Join-Path $_ "bin") -Filter "Stilista*.exe" -ErrorAction SilentlyContinue)
    }
}

if (-not $Stilista) {
    $Stilista = @(Cartelle-Stilista) | Select-Object -First 1
    if (-not $Stilista) { throw "Non trovo Stilista. Indicare la cartella: installa.ps1 -Stilista 'C:\...\Stilista3.3'" }
}
$lista = Join-Path $Stilista "PLUG-INS\pluginlist.txt"
if (-not (Test-Path -LiteralPath $lista)) { throw "Non e' una cartella di Stilista (manca PLUG-INS\pluginlist.txt): $Stilista" }
if (-not $Plugin) { $Plugin = Join-Path $qui "StilistaLink.exe" }
if (-not (Test-Path -LiteralPath $Plugin)) { throw "Manca il plugin: $Plugin" }

$radice = Join-Path $Stilista "PLUG-INS\RGStilistaLink"
$versione = Get-Date -Format "yyyyMMdd-HHmmss"
$cartella = Join-Path $radice $versione
$installato = Join-Path $cartella "StilistaLink.exe"
try {
    New-Item -ItemType Directory -Force -Path $cartella | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $radice "backup") | Out-Null
} catch {
    throw "Non posso scrivere in $radice. Rieseguire Installa.cmd con il tasto destro -> Esegui come amministratore."
}
Copy-Item -LiteralPath $Plugin -Destination $installato -Force
# un file scaricato da internet porta il segno "da internet": .NET non lo caricherebbe
Unblock-File -LiteralPath $installato -ErrorAction SilentlyContinue

$indirizzoTxt = Join-Path $cartella "indirizzo.txt"
if ($Indirizzo) {
    Set-Content -LiteralPath $indirizzoTxt -Value $Indirizzo -Encoding ASCII
} elseif (Test-Path -LiteralPath (Join-Path $qui "indirizzo.txt")) {
    Copy-Item -LiteralPath (Join-Path $qui "indirizzo.txt") -Destination $indirizzoTxt
}

Copy-Item -LiteralPath $lista -Destination (Join-Path $radice "backup\pluginlist-$versione.txt")
$codifica = [Text.Encoding]::Default
$righe = @([IO.File]::ReadAllLines($lista, $codifica) | Where-Object {
    -not [string]::IsNullOrWhiteSpace($_) -and $_ -notlike "*\PLUG-INS\RGStilistaLink\*"
})
[IO.File]::WriteAllLines($lista, [string[]]($righe + $installato), $codifica)

# le versioni di prima, solo se Stilista e' chiuso del tutto. Stilista tiene processi di riserva gia' avviati,
# che hanno letto pluginlist.txt prima di adesso e caricano il plugin di prima quando aprono un documento:
# toglierne la cartella (o solo indirizzo.txt, se l'exe e' bloccato) lo rompe (2026-10-28)
$aperti = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like 'Stilista*' })
$tolte = 0
if ($aperti.Count -eq 0) {
    Get-ChildItem -LiteralPath $radice -Directory | Where-Object { $_.Name -match '^\d{8}-\d{6}$' -and $_.Name -ne $versione } | ForEach-Object {
        # .NET e non Remove-Item -Recurse, che in PowerShell 5 non trova le cartelle coi nomi brevi (NOME~1)
        try { [IO.Directory]::Delete($_.FullName, $true); $tolte++ } catch {}
    }
}

$verso = if (Test-Path -LiteralPath $indirizzoTxt) { (Get-Content -LiteralPath $indirizzoTxt | Where-Object { $_ -and -not $_.StartsWith('#') } | Select-Object -First 1) } else { "la suite online" }
Write-Host ""
Write-Host "RG Stilista Link installato in $cartella"
Write-Host "  Stilista: $Stilista"
Write-Host "  la suite: $verso"
if ($tolte -gt 0) { Write-Host "  tolte $tolte versioni precedenti" }
if ($aperti.Count -gt 0) {
    Write-Host "Stilista e' aperto ($($aperti.Count) processi, comprese le riserve senza finestra): questa versione"
    Write-Host "la carica solo dopo averlo chiuso del tutto e riaperto. Le versioni precedenti restano finche' e' aperto."
} else {
    Write-Host "Al prossimo avvio di Stilista c'e' la scheda RG_LINK."
}
