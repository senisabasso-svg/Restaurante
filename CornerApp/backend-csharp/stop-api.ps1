# Script para detener CornerApp.API

Write-Host "Deteniendo procesos de CornerApp.API..." -ForegroundColor Yellow
$processes = Get-Process -Name "CornerApp.API" -ErrorAction SilentlyContinue

if ($processes) {
    $processes | Stop-Process -Force
    Write-Host "Procesos detenidos correctamente." -ForegroundColor Green
} else {
    Write-Host "No hay procesos de CornerApp.API ejecutándose." -ForegroundColor Gray
}

