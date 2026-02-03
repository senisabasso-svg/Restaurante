namespace CornerApp.API.Models;

/// <summary>
/// Representa un restaurante en el sistema multi-tenant
/// </summary>
public class Restaurant
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Identifier { get; set; } = string.Empty; // Unique identifier for login
    public string? Description { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Relaciones
    public List<Admin> Admins { get; set; } = new();
    public List<Order> Orders { get; set; } = new();
    public List<Product> Products { get; set; } = new();
    public List<Category> Categories { get; set; } = new();
    public List<Table> Tables { get; set; } = new();
    public List<Space> Spaces { get; set; } = new();
    public List<DeliveryPerson> DeliveryPersons { get; set; } = new();
    public List<Customer> Customers { get; set; } = new();
    public List<CashRegister> CashRegisters { get; set; } = new();
    public List<DeliveryCashRegister> DeliveryCashRegisters { get; set; } = new();
    public BusinessInfo? BusinessInfo { get; set; }
    public DeliveryZoneConfig? DeliveryZoneConfig { get; set; }
    public EmailConfig? EmailConfig { get; set; }
}
