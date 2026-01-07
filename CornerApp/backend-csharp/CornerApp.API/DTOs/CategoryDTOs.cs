namespace CornerApp.API.DTOs;

/// <summary>
/// DTO para crear una categoría
/// </summary>
public class CreateCategoryRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// DTO para actualizar una categoría
/// </summary>
public class UpdateCategoryRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public int? DisplayOrder { get; set; }
    public bool? IsActive { get; set; }
}

/// <summary>
/// DTO para actualización parcial de una categoría (PATCH)
/// </summary>
public class PatchCategoryRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public int? DisplayOrder { get; set; }
    public bool? IsActive { get; set; }
}
