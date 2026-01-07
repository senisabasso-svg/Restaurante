// Script para crear el primer administrador
// Ejecutar desde Package Manager Console: dotnet ef migrations script
// O ejecutar directamente en Program.cs al iniciar (solo desarrollo)

using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;
using BCrypt.Net;

namespace CornerApp.API.Scripts;

public static class CreateAdminScript
{
    public static async Task CreateDefaultAdmin(ApplicationDbContext context)
    {
        // Verificar si ya existe un admin
        var existingAdmin = await context.Admins.FirstOrDefaultAsync();
        if (existingAdmin != null)
        {
            Console.WriteLine("Ya existe un administrador en la base de datos.");
            return;
        }

        // Crear admin por defecto
        // Usuario: admin
        // Contraseña: admin123 (CAMBIAR EN PRODUCCIÓN)
        var admin = new Admin
        {
            Username = "admin",
            Email = "admin@cornerapp.com",
            Name = "Administrador",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
            CreatedAt = DateTime.UtcNow
        };

        context.Admins.Add(admin);
        await context.SaveChangesAsync();

        Console.WriteLine("✅ Administrador creado exitosamente:");
        Console.WriteLine($"   Usuario: admin");
        Console.WriteLine($"   Contraseña: admin123");
        Console.WriteLine("⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión!");
    }
}

