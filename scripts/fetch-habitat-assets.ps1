$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Target = Join-Path $ProjectRoot "public\assets\habitat\kenney"
New-Item -ItemType Directory -Force -Path $Target | Out-Null

$Base = "https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenneyrpgpack"
$Files = @(
    @{ Url = "$Base/Spritesheet/RPGpack_sheet.png"; Name = "RPGpack_sheet.png" },
    @{ Url = "$Base/PNG/rpgTile000.png"; Name = "rpgTile000.png" },
    @{ Url = "$Base/PNG/rpgTile004.png"; Name = "rpgTile004.png" }
)

Write-Host "Fetching CC0 Kenney habitat assets..." -ForegroundColor Cyan
foreach ($File in $Files) {
    $Destination = Join-Path $Target $File.Name
    Write-Host "  -> $($File.Name)"
    Invoke-WebRequest -Uri $File.Url -OutFile $Destination
}

Write-Host ""
Write-Host "Done. Assets were saved to:" -ForegroundColor Green
Write-Host "  $Target"
Write-Host ""
Write-Host "Primary artist/source: Kenney - https://kenney.nl/assets/roguelike-rpg-pack"
Write-Host "License: CC0 1.0 Universal"
