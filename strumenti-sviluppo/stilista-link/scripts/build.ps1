param(
    [string]$StilistaInstallDir = "C:\GMI\Stilista3.3"
)

$ErrorActionPreference = "Stop"
$progetto = Join-Path $PSScriptRoot "..\StilistaLink.csproj"

dotnet build $progetto -c Release -v q -nologo -p:StilistaInstallDir=$StilistaInstallDir
if ($LASTEXITCODE -ne 0) {
    throw "Compilazione fallita."
}
Write-Host "Compilato: $(Resolve-Path (Join-Path $PSScriptRoot '..\bin\Release\net48\StilistaLink.exe'))"
