# Script para aplicar los cambios de configuración de OrderItems
# Ejecutar desde la carpeta backend-csharp

Write-Host "🔧 Aplicando cambios de configuración de OrderItems..." -ForegroundColor Cyan

# Navegar a la carpeta del proyecto API
Set-Location "CornerApp.API"

# Crear migración para los cambios
Write-Host "📦 Creando migración..." -ForegroundColor Yellow
dotnet ef migrations add FixOrderItemsConfiguration --project . --startup-project .

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migración creada exitosamente" -ForegroundColor Green
    
    # Aplicar migración a la base de datos
    Write-Host "🗄️ Aplicando migración a la base de datos..." -ForegroundColor Yellow
    dotnet ef database update --project . --startup-project .
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migración aplicada exitosamente" -ForegroundColor Green
        Write-Host "🎉 Cambios aplicados correctamente. Puedes reiniciar el backend ahora." -ForegroundColor Green
    } else {
        Write-Host "❌ Error al aplicar la migración" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Error al crear la migración" -ForegroundColor Red
    Write-Host "💡 Si la migración ya existe, puedes aplicar directamente con: dotnet ef database update" -ForegroundColor Yellow
    exit 1
}

# Volver al directorio original
Set-Location ..

