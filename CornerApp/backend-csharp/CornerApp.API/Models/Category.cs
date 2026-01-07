namespace CornerApp.API.Models;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // pizza, bebida, postre
    public string Description { get; set; } = string.Empty;
    public string? Icon { get; set; } // URL del ícono o nombre del ícono
    public int DisplayOrder { get; set; } // Orden de visualización
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Relación con productos (ignorar en JSON para evitar referencias circulares)
    [System.Text.Json.Serialization.JsonIgnore]
    public List<Product> Products { get; set; } = new();
}

