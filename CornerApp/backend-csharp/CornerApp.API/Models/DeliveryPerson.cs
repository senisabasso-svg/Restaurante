namespace CornerApp.API.Models;

public class DeliveryPerson
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Username { get; set; } = string.Empty; // Usuario para login
    public string PasswordHash { get; set; } = string.Empty; // Hash de la contraseña
    public bool IsActive { get; set; } = true; // Si el repartidor está activo
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Relación con pedidos
    public List<Order> Orders { get; set; } = new();
}

