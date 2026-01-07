namespace CornerApp.API.Models;

/// <summary>
/// Representa un espacio o área del restaurante (ej: Planta 1, Terraza, Fondo)
/// </summary>
public class Space
{
    public int Id { get; set; }
    
    /// <summary>
    /// Nombre del espacio (ej: "Planta 1", "Terraza", "Fondo", "Exterior")
    /// </summary>
    public string Name { get; set; } = string.Empty;
    
    /// <summary>
    /// Descripción opcional del espacio
    /// </summary>
    public string? Description { get; set; }
    
    /// <summary>
    /// Si el espacio está activo (no eliminado)
    /// </summary>
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Relación con mesas
    [System.Text.Json.Serialization.JsonIgnore]
    public List<Table> Tables { get; set; } = new();
}

