namespace CornerApp.API.Models;

public class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? DefaultAddress { get; set; }
    public string? DocumentType { get; set; } // Cedula, Rut, Otro
    public string? DocumentNumber { get; set; }
    public string PasswordHash { get; set; } = string.Empty; // Hash de la contraseña
    public int Points { get; set; } = 0; // Puntos acumulados por pedidos
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Relación con pedidos
    public List<Order> Orders { get; set; } = new();
}

