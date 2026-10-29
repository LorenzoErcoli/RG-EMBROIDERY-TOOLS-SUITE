# RG Stilista Link - disinstallazione, senza lasciare traccia.
# Toglie la riga del plugin da pluginlist.txt (senza rimettere una copia vecchia: gli altri plugin restano
# come sono ora), cancella PLUG-INS\RGStilistaLink\ (plugin, indirizzo, copie di sicurezza), i file di
# passaggio in %TEMP%\rg-stilista-link\ e il registro %TEMP%\rg-stilista-link.log.
# Restano, perche' sono lavoro dell'utente, i ricami gia' tornati nei documenti.
# (Solo ASCII qui: PowerShell 5 legge gli script senza BOM come ANSI.)
param(
    [string]$Stilista = ""    # la cartella di Stilista; vuota = tutte quelle dove il plugin c'e'
)
$ErrorActionPreference = "Stop"

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
    $trovate | Select-Object -Unique | Where-Object { Test-Path (Join-Path $_ "PLUG-INS\pluginlist.txt") }
}

# Remove-Item -Recurse di PowerShell 5 non trova le cartelle coi nomi brevi (C:\Users\NOME~1\...), che
# %TEMP% spesso usa: si cancella con .NET
function Cancella([string]$percorso) {
    if ([IO.Directory]::Exists($percorso)) {
        Get-ChildItem -LiteralPath $percorso -Recurse -Force | ForEach-Object { $_.Attributes = 'Normal' }
        [IO.Directory]::Delete($percorso, $true)
    } elseif ([IO.File]::Exists($percorso)) {
        [IO.File]::Delete($percorso)
    }
}

$cartelle = if ($Stilista) { @($Stilista) } else { @(Cartelle-Stilista) }
$fatto = $false
foreach ($s in $cartelle) {
    $lista = Join-Path $s "PLUG-INS\pluginlist.txt"
    $radice = Join-Path $s "PLUG-INS\RGStilistaLink"
    $codifica = [Text.Encoding]::Default
    $righe = if (Test-Path -LiteralPath $lista) { @([IO.File]::ReadAllLines($lista, $codifica)) } else { @() }
    $nostre = @($righe | Where-Object { $_ -like "*\PLUG-INS\RGStilistaLink\*" })
    if ($nostre.Count -eq 0 -and -not (Test-Path -LiteralPath $radice)) { continue }
    $fatto = $true

    # uno Stilista aperto tiene bloccato il plugin
    $bin = (Join-Path $s "bin") + "\"
    $aperti = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessName -like 'Stilista*' -and $_.Path -and $_.Path.StartsWith($bin, [StringComparison]::OrdinalIgnoreCase)
    })
    $conFinestra = @($aperti | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero })
    if ($conFinestra.Count -gt 0) {
        Write-Host "Stilista e' aperto ($($conFinestra.Count) finestre): salvare, chiudere tutte le finestre di Stilista e rieseguire Disinstalla.cmd."
        exit 1
    }
    # senza finestre restano i processi d'avvio e di riserva di Stilista: non hanno documenti
    foreach ($p in $aperti) { try { Stop-Process -Id $p.Id -Force; Write-Host "  chiuso un processo di Stilista senza finestre (pid $($p.Id))" } catch {} }
    if ($aperti.Count -gt 0) { Start-Sleep -Seconds 2 }

    if ($nostre.Count -gt 0) {
        $resto = @($righe | Where-Object { $_ -notlike "*\PLUG-INS\RGStilistaLink\*" })
        [IO.File]::WriteAllLines($lista, [string[]]$resto, $codifica)
        Write-Host "Tolta da $lista la riga del plugin."
    }
    if (Test-Path -LiteralPath $radice) {
        try { Cancella $radice; Write-Host "Cancellata $radice" }
        catch { Write-Host "Non riesco a cancellare $radice ($($_.Exception.Message)): chiudere Stilista e rieseguire."; exit 1 }
    }
    # le copie di sicurezza delle installazioni di sviluppo di prima (pluginlist.txt.<data-ora>.bak con la nostra riga)
    $vecchie = @(Get-ChildItem -LiteralPath (Join-Path $s "PLUG-INS") -Filter "pluginlist.txt.*.bak" -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match '^pluginlist\.txt\.\d{8}-\d{6}\.bak$' -and (Select-String -LiteralPath $_.FullName -SimpleMatch "\PLUG-INS\RGStilistaLink\" -Quiet)
    })
    $vecchie | ForEach-Object { Cancella $_.FullName }
    if ($vecchie.Count -gt 0) { Write-Host "Cancellate $($vecchie.Count) copie di sicurezza vecchie di pluginlist.txt" }
}

foreach ($t in @((Join-Path $env:TEMP "rg-stilista-link"), (Join-Path $env:TEMP "rg-stilista-link.log"))) {
    if (Test-Path -LiteralPath $t) {
        try { Cancella $t; Write-Host "Cancellato $t" }
        catch { Write-Host "Non riesco a cancellare $t (in uso?): $($_.Exception.Message)" }
    }
}

Write-Host ""
if ($fatto) { Write-Host "RG Stilista Link disinstallato." } else { Write-Host "RG Stilista Link non era installato." }
Write-Host "Se si e' usata la suite online: nel browser, lucchetto accanto all'indirizzo della suite ->"
Write-Host "Impostazioni sito -> togliere il permesso alla rete locale (non e' un file, va tolto a mano)."
