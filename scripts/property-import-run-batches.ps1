param(
    [string]$File = "c:\Users\conne\Downloads\dados dos imoveis.txt",
    [int]$StartOffset = 0,
    [int]$BatchSize = 50,
    [int]$MaxProperties = 2447,
    [int]$Concurrency = 6,
    [switch]$SkipImages
)

$ErrorActionPreference = "Stop"

$offset = $StartOffset
$end = $StartOffset + $MaxProperties

while ($offset -lt $end) {
    $remaining = $end - $offset
    $limit = [Math]::Min($BatchSize, $remaining)
    Write-Host ""
    Write-Host "=== Importando lote: offset=$offset limit=$limit ===" -ForegroundColor Cyan

    $npmArgs = @(
        "run", "import:properties:apply", "--",
        "--file", $File,
        "--offset", "$offset",
        "--limit", "$limit",
        "--concurrency", "$Concurrency",
        "--apply"
    )

    if ($SkipImages) {
        $npmArgs += "--skip-images"
    }

    & npm @npmArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Lote falhou no offset $offset. Corrija e retome com -StartOffset $offset." -ForegroundColor Red
        exit $LASTEXITCODE
    }

    $offset += $limit
}

Write-Host ""
Write-Host "Importacao em lotes concluida." -ForegroundColor Green
