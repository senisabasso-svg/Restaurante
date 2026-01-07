# Script para ejecutar CornerApp.API con watch mode (recomendado para desarrollo)
# Detiene cualquier instancia previa antes de ejecutar

Write-Host "Deteniendo procesos existentes de CornerApp.API..." -ForegroundColor Yellow
$processes = Get-Process -Name "CornerApp.API" -ErrorAction SilentlyContinue
if ($processes) {
    $processes | ForEach-Object { 
        Write-Host "Deteniendo proceso PID: $($_.Id)" -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 3
    
    # Verificar que se detuvieron
    $remaining = Get-Process -Name "CornerApp.API" -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Host "Advertencia: Algunos procesos aún están ejecutándose. Intentando detener nuevamente..." -ForegroundColor Red
        $remaining | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 2
    }
} else {
    Write-Host "No hay procesos ejecutándose." -ForegroundColor Gray
}

Write-Host "Ejecutando CornerApp.API con watch mode..." -ForegroundColor Green
Write-Host "(El watch mode reinicia automáticamente cuando detecta cambios)" -ForegroundColor Cyan
Set-Location "CornerApp.API"

# Limpiar archivos de compilación anteriores
Write-Host "Limpiando archivos de compilación..." -ForegroundColor Gray
dotnet clean -q 2>$null

Write-Host "Iniciando aplicación con watch..." -ForegroundColor Green
dotnet watch run

