# Script para levantar Backend y Frontend de CornerApp
# Ejecuta este script desde la raíz del proyecto

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CornerApp - Iniciando Servicios" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "backend-csharp")) {
    Write-Host "Error: Este script debe ejecutarse desde la raíz del proyecto" -ForegroundColor Red
    exit 1
}

Write-Host "Este script abrirá 2 ventanas de PowerShell:" -ForegroundColor Yellow
Write-Host "  1. Backend (puerto 5000)" -ForegroundColor Green
Write-Host "  2. Frontend (puerto 3000)" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona cualquier tecla para continuar..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Obtener la ruta del proyecto
$projectRoot = (Get-Location).Path

# Iniciar Backend en nueva ventana
Write-Host "Iniciando Backend..." -ForegroundColor Green
$backendPath = Join-Path $projectRoot "backend-csharp\CornerApp.API"
$backendScript = "cd '$backendPath'; Write-Host 'Backend iniciando en http://localhost:5000' -ForegroundColor Green; Write-Host 'Swagger UI: http://localhost:5000/swagger' -ForegroundColor Cyan; dotnet run"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript

# Esperar un poco antes de iniciar el frontend
Start-Sleep -Seconds 3

# Iniciar Frontend en nueva ventana
Write-Host "Iniciando Frontend..." -ForegroundColor Green
$frontendPath = Join-Path $projectRoot "frontend"
$frontendScript = "cd '$frontendPath'; Write-Host 'Frontend iniciando en http://localhost:3000' -ForegroundColor Green; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Servicios iniciados!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:5000/swagger" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar esta ventana..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

