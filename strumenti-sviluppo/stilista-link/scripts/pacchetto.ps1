# Prepara lo zip da dare a chi prova il plugin: out\RG-Stilista-Link-<data>.zip con il plugin compilato,
# Installa.cmd / Disinstalla.cmd, gli script, l'indirizzo della suite online e il LEGGIMI.
# (Solo ASCII qui: PowerShell 5 legge gli script senza BOM come ANSI.)
$ErrorActionPreference = "Stop"
$base = Split-Path $PSScriptRoot -Parent
& (Join-Path $PSScriptRoot "build.ps1")
$exe = Join-Path $base "bin\Release\net48\StilistaLink.exe"

$nome = "RG-Stilista-Link-" + (Get-Date -Format "yyyyMMdd")
$out = Join-Path $base "out"
$cartella = Join-Path $out $nome
if (Test-Path -LiteralPath $cartella) { Remove-Item -LiteralPath $cartella -Recurse -Force }
New-Item -ItemType Directory -Force -Path $cartella | Out-Null

Copy-Item -LiteralPath $exe -Destination $cartella
foreach ($f in "installa.ps1", "disinstalla.ps1", "Installa.cmd", "Disinstalla.cmd", "indirizzo.txt", "LEGGIMI.txt") {
    # a capo di Windows: cmd e il Blocco note vecchio li vogliono
    $testo = [IO.File]::ReadAllText((Join-Path $base "pacchetto\$f")) -replace "`r?`n", "`r`n"
    $codifica = if ($f -eq "LEGGIMI.txt") { New-Object Text.UTF8Encoding $true } else { [Text.Encoding]::ASCII }
    [IO.File]::WriteAllText((Join-Path $cartella $f), $testo, $codifica)
}
$commit = (git -C $base rev-parse --short HEAD 2>$null)
Set-Content -LiteralPath (Join-Path $cartella "versione.txt") -Encoding ASCII -Value "RG Stilista Link, $(Get-Date -Format 'yyyy-MM-dd HH:mm'), commit $commit"

$zip = Join-Path $out "$nome.zip"
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
Compress-Archive -Path (Join-Path $cartella "*") -DestinationPath $zip
Write-Host "Pacchetto: $zip"
