# Script para insertar usuario Admin
# Ejecutar desde: backend-csharp\CornerApp.API

$email = "berni2384@hotmail.com"
$password = "berni1"
$name = "Berni"

Write-Host "Generando hash de contraseña..." -ForegroundColor Yellow

# Crear un script C# temporal para generar el hash
$tempScript = @"
using System;
using BCrypt.Net;

class Program {
    static void Main() {
        string password = "$password";
        string hash = BCrypt.Net.BCrypt.HashPassword(password);
        Console.WriteLine(hash);
    }
}
"@

$tempScript | Out-File -FilePath "temp_hash.cs" -Encoding UTF8

Write-Host "Compilando script temporal..." -ForegroundColor Yellow
dotnet run --project . --no-build 2>&1 | Out-Null

# Alternativa: usar SQL directo con hash conocido
# El hash de "berni1" con BCrypt es aproximadamente: `$2a$11$...`
# Pero es mejor generar el hash dinámicamente

Write-Host "Ejecutando script C# para generar hash..." -ForegroundColor Yellow

# Mejor opción: crear un endpoint temporal o usar el contexto directamente
Write-Host "Usando método alternativo: creando script SQL con hash generado..." -ForegroundColor Cyan

