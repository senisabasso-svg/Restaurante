using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CornerApp.API.Services;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador para subida de archivos en el dashboard de administración
/// </summary>
[ApiController]
[Tags("Administración - Archivos")]
[Authorize(Roles = "Admin")]
public class AdminFileUploadController : ControllerBase
{
    private readonly IFileUploadService _fileUploadService;
    private readonly ILogger<AdminFileUploadController> _logger;

    public AdminFileUploadController(
        IFileUploadService fileUploadService,
        ILogger<AdminFileUploadController> logger)
    {
        _fileUploadService = fileUploadService;
        _logger = logger;
    }

    /// <summary>
    /// API endpoint para subir un icono de categoría
    /// </summary>
    [HttpPost("admin/api/categories/upload-icon")]
    public async Task<ActionResult> UploadCategoryIcon(IFormFile file)
    {
        try
        {
            var (url, fileName) = await _fileUploadService.UploadCategoryIconAsync(file);
            return Ok(new { url, fileName });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al subir icono de categoría");
            return StatusCode(500, new { error = "Error al subir el icono", details = ex.Message });
        }
    }

    /// <summary>
    /// API endpoint para subir una imagen de producto
    /// </summary>
    [HttpPost("admin/api/products/upload-image")]
    public async Task<ActionResult> UploadProductImage(IFormFile file)
    {
        try
        {
            var (url, fileName) = await _fileUploadService.UploadProductImageAsync(file);
            return Ok(new { url, fileName });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al subir imagen de producto");
            return StatusCode(500, new { error = "Error al subir la imagen", details = ex.Message });
        }
    }
}

