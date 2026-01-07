using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CornerApp.API.Constants;
using CornerApp.API.Helpers;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace CornerApp.API.Services;

/// <summary>
/// Implementación del servicio para manejar la subida y optimización de archivos
/// </summary>
public class FileUploadService : IFileUploadService
{
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<FileUploadService> _logger;

    public FileUploadService(
        IWebHostEnvironment environment,
        ILogger<FileUploadService> logger)
    {
        _environment = environment;
        _logger = logger;
    }

    /// <summary>
    /// Sube y optimiza un icono de categoría
    /// </summary>
    public async Task<(string url, string fileName)> UploadCategoryIconAsync(IFormFile file)
    {
        // Validar archivo
        var (isValid, errorMessage) = FileValidationHelper.ValidateImageFile(
            file, 
            AppConstants.MAX_ICON_FILE_SIZE_BYTES,
            allowIcons: true
        );

        if (!isValid)
        {
            throw new ArgumentException(errorMessage);
        }

        // Crear directorio si no existe
        var iconsPath = Path.Combine(_environment.ContentRootPath, AppConstants.WWWROOT_FOLDER, AppConstants.IMAGES_FOLDER, AppConstants.CATEGORIES_FOLDER);
        if (!Directory.Exists(iconsPath))
        {
            Directory.CreateDirectory(iconsPath);
        }

        // Generar nombre único para el archivo
        var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"{Guid.NewGuid()}{fileExtension}";
        var filePath = Path.Combine(iconsPath, fileName);

        // Guardar archivo
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Optimizar icono
        await OptimizeImageAsync(filePath, AppConstants.MAX_ICON_WIDTH_PX);

        // Retornar URL del icono
        var iconUrl = $"{AppConstants.CATEGORIES_IMAGE_URL_BASE}{fileName}";
        
        _logger.LogInformation("Icono de categoría subido exitosamente: {FileName}", fileName);
        return (iconUrl, fileName);
    }

    /// <summary>
    /// Sube y optimiza una imagen de producto
    /// </summary>
    public async Task<(string url, string fileName)> UploadProductImageAsync(IFormFile file)
    {
        // Validar archivo
        var (isValid, errorMessage) = FileValidationHelper.ValidateImageFile(
            file, 
            AppConstants.MAX_PRODUCT_IMAGE_SIZE_BYTES,
            maxWidth: AppConstants.MAX_IMAGE_WIDTH_PX
        );

        if (!isValid)
        {
            throw new ArgumentException(errorMessage);
        }

        // Crear directorio si no existe
        var imagesPath = Path.Combine(_environment.ContentRootPath, AppConstants.WWWROOT_FOLDER, AppConstants.IMAGES_FOLDER, AppConstants.PRODUCTS_FOLDER);
        if (!Directory.Exists(imagesPath))
        {
            Directory.CreateDirectory(imagesPath);
        }

        // Generar nombre único para el archivo
        var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"{Guid.NewGuid()}{fileExtension}";
        var filePath = Path.Combine(imagesPath, fileName);

        // Guardar archivo
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Optimizar imagen
        await OptimizeImageAsync(filePath, AppConstants.MAX_IMAGE_WIDTH_PX);

        // Retornar URL de la imagen
        var imageUrl = $"{AppConstants.PRODUCTS_IMAGE_URL_BASE}{fileName}";
        
        _logger.LogInformation("Imagen de producto subida exitosamente: {FileName}", fileName);
        return (imageUrl, fileName);
    }

    /// <summary>
    /// Optimiza una imagen redimensionándola si es necesario
    /// </summary>
    private async Task OptimizeImageAsync(string filePath, int maxWidth)
    {
        try
        {
            using (var image = await Image.LoadAsync(filePath))
            {
                // Redimensionar si es mayor al ancho máximo configurado
                if (image.Width > maxWidth)
                {
                    var ratio = (float)maxWidth / image.Width;
                    var newHeight = (int)(image.Height * ratio);
                    image.Mutate(x => x.Resize(new ResizeOptions
                    {
                        Size = new Size(maxWidth, newHeight),
                        Mode = ResizeMode.Max
                    }));
                    await image.SaveAsync(filePath);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo optimizar la imagen en {FilePath}, pero se guardó correctamente", filePath);
            // No lanzar excepción, la imagen se guardó correctamente
        }
    }
}

