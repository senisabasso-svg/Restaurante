namespace CornerApp.API.Services;

/// <summary>
/// Servicio para manejar la subida y optimización de archivos
/// </summary>
public interface IFileUploadService
{
    /// <summary>
    /// Sube y optimiza un icono de categoría
    /// </summary>
    Task<(string url, string fileName)> UploadCategoryIconAsync(Microsoft.AspNetCore.Http.IFormFile file);

    /// <summary>
    /// Sube y optimiza una imagen de producto
    /// </summary>
    Task<(string url, string fileName)> UploadProductImageAsync(Microsoft.AspNetCore.Http.IFormFile file);
}

