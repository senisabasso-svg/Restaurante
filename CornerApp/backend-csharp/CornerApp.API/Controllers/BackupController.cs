using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CornerApp.API.Services;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador para gestionar backups de la base de datos
/// </summary>
[ApiController]
[Route("api/admin/backup")]
[Tags("Administración - Backup")]
[Authorize] // Requiere autenticación
public class BackupController : ControllerBase
{
    private readonly IDatabaseBackupService _backupService;
    private readonly ILogger<BackupController> _logger;

    public BackupController(
        IDatabaseBackupService backupService,
        ILogger<BackupController> logger)
    {
        _backupService = backupService;
        _logger = logger;
    }

    /// <summary>
    /// Crea un backup manual de la base de datos
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<BackupResult>> CreateBackup()
    {
        try
        {
            var result = await _backupService.CreateBackupAsync();
            
            if (result.Success)
            {
                _logger.LogInformation("Backup manual creado exitosamente: {BackupFilePath}", result.BackupFilePath);
                return Ok(result);
            }
            else
            {
                _logger.LogError("Error al crear backup manual: {ErrorMessage}", result.ErrorMessage);
                return StatusCode(500, new { error = "Error al crear backup", details = result.ErrorMessage });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear backup manual");
            return StatusCode(500, new { error = "Error al crear backup", details = ex.Message });
        }
    }

    /// <summary>
    /// Obtiene el historial de backups
    /// </summary>
    [HttpGet("history")]
    public async Task<ActionResult<List<BackupInfo>>> GetBackupHistory()
    {
        try
        {
            var history = await _backupService.GetBackupHistoryAsync();
            return Ok(history);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener historial de backups");
            return StatusCode(500, new { error = "Error al obtener historial de backups", details = ex.Message });
        }
    }

    /// <summary>
    /// Restaura un backup desde un archivo
    /// </summary>
    [HttpPost("restore")]
    public async Task<ActionResult> RestoreBackup([FromBody] RestoreBackupRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.BackupFilePath))
            {
                return BadRequest(new { error = "La ruta del archivo de backup es requerida" });
            }

            var success = await _backupService.RestoreBackupAsync(request.BackupFilePath);
            
            if (success)
            {
                _logger.LogWarning("Backup restaurado exitosamente: {BackupFilePath}", request.BackupFilePath);
                return Ok(new { message = "Backup restaurado exitosamente", backupFilePath = request.BackupFilePath });
            }
            else
            {
                return StatusCode(500, new { error = "Error al restaurar backup" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al restaurar backup: {BackupFilePath}", request.BackupFilePath);
            return StatusCode(500, new { error = "Error al restaurar backup", details = ex.Message });
        }
    }
}

/// <summary>
/// Request para restaurar un backup
/// </summary>
public class RestoreBackupRequest
{
    public string BackupFilePath { get; set; } = string.Empty;
}
