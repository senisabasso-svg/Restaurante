namespace CornerApp.API.Models;

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Image { get; set; } = string.Empty;
    public int DisplayOrder { get; set; } = 0; // Orden de visualización
    public bool IsAvailable { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Relación con categoría
    public int CategoryId { get; set; }
    
    // Navegación a Category (se incluye para EF Core, pero se serializa solo el nombre)
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public Category? Category { get; set; }
    
    // Propiedad para serialización JSON (incluir nombre de categoría como string)
    [System.Text.Json.Serialization.JsonPropertyName("category")]
    public string CategoryName => Category?.Name ?? string.Empty;
    
    // Relación con SubProducts (guarniciones)
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public ICollection<SubProduct>? SubProducts { get; set; }
}

