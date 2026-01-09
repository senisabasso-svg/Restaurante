namespace CornerApp.API.DTOs;

/// <summary>
/// DTO para crear un subproducto
/// </summary>
public class CreateSubProductRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int ProductId { get; set; }
    public int DisplayOrder { get; set; } = 0;
    public bool IsAvailable { get; set; } = true;
}

/// <summary>
/// DTO para actualizar un subproducto
/// </summary>
public class UpdateSubProductRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public int? ProductId { get; set; }
    public int? DisplayOrder { get; set; }
    public bool? IsAvailable { get; set; }
}

