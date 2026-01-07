namespace CornerApp.API.DTOs;

/// <summary>
/// DTO para crear un producto
/// </summary>
public class CreateProductRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string? Image { get; set; }
    public int CategoryId { get; set; }
    public int DisplayOrder { get; set; } = 0;
    public bool IsAvailable { get; set; } = true;
}

/// <summary>
/// DTO para actualizar un producto
/// </summary>
public class UpdateProductRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public string? Image { get; set; }
    public int? CategoryId { get; set; }
    public int? DisplayOrder { get; set; }
    public bool? IsAvailable { get; set; }
}

/// <summary>
/// DTO para actualización parcial de un producto (PATCH)
/// </summary>
public class PatchProductRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public string? Image { get; set; }
    public int? CategoryId { get; set; }
    public bool? IsAvailable { get; set; }
}
