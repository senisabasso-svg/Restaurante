using CornerApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controller para consultar eventos de auditoría
/// </summary>
[ApiController]
[Route("api/audit")]
[Tags("Auditoría")]
[Authorize] // Requiere autenticación para ver auditoría
public class AuditController : ControllerBase
{
    private readonly IAuditService _auditService;
    private readonly ILogger<AuditController> _logger;

    public AuditController(
        IAuditService auditService,
        ILogger<AuditController> logger)
    {
        _auditService = auditService;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene eventos de auditoría con filtros
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetEvents(
        [FromQuery] string? entityType = null,
        [FromQuery] int? entityId = null,
        [FromQuery] int? userId = null,
        [FromQuery] string? action = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var query = new AuditQuery
            {
                EntityType = entityType,
                EntityId = entityId,
                UserId = userId,
                Action = action,
                FromDate = fromDate,
                ToDate = toDate,
                Page = page,
                PageSize = pageSize
            };

            var events = await _auditService.GetEventsAsync(query);

            return Ok(new
            {
                success = true,
                message = "Eventos de auditoría obtenidos",
                data = events,
                pagination = new
                {
                    page = page,
                    pageSize = pageSize,
                    totalItems = events.Count
                },
                requestId = HttpContext.Items["RequestId"]?.ToString(),
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener eventos de auditoría");
            return StatusCode(500, new
            {
                success = false,
                message = "Error al obtener eventos de auditoría",
                error = ex.Message,
                requestId = HttpContext.Items["RequestId"]?.ToString()
            });
        }
    }

    /// <summary>
    /// Obtiene eventos de auditoría para una entidad específica
    /// </summary>
    [HttpGet("entity/{entityType}/{entityId}")]
    public async Task<IActionResult> GetEventsForEntity(string entityType, int entityId)
    {
        try
        {
            var events = await _auditService.GetEventsForEntityAsync(entityType, entityId);

            return Ok(new
            {
                success = true,
                message = $"Eventos de auditoría para {entityType} (ID: {entityId})",
                data = events,
                requestId = HttpContext.Items["RequestId"]?.ToString(),
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener eventos de auditoría para entidad {EntityType} {EntityId}", 
                entityType, entityId);
            return StatusCode(500, new
            {
                success = false,
                message = "Error al obtener eventos de auditoría",
                error = ex.Message,
                requestId = HttpContext.Items["RequestId"]?.ToString()
            });
        }
    }
}
