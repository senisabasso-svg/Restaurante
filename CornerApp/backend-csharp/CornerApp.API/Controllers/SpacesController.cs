using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Models;
using CornerApp.API.Data;

namespace CornerApp.API.Controllers;

[ApiController]
[Route("api/spaces")]
[Tags("Espacios")]
[Authorize]
public class SpacesController : ControllerBase
{
    private readonly ILogger<SpacesController> _logger;
    private readonly ApplicationDbContext _context;

    public SpacesController(ILogger<SpacesController> logger, ApplicationDbContext context)
    {
        _logger = logger;
        _context = context;
    }

    /// <summary>
    /// Obtiene todos los espacios activos
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Space>>> GetSpaces()
    {
        var spaces = await _context.Spaces
            .AsNoTracking()
            .Where(s => s.IsActive)
            .Include(s => s.Tables.Where(t => t.IsActive))
            .OrderBy(s => s.Name)
            .ToListAsync();

        return Ok(spaces);
    }

    /// <summary>
    /// Obtiene un espacio por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<Space>> GetSpace(int id)
    {
        var space = await _context.Spaces
            .AsNoTracking()
            .Include(s => s.Tables.Where(t => t.IsActive))
            .FirstOrDefaultAsync(s => s.Id == id);

        if (space == null)
        {
            return NotFound(new { error = "Espacio no encontrado" });
        }

        return Ok(space);
    }

    /// <summary>
    /// Crea un nuevo espacio
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Space>> CreateSpace([FromBody] CreateSpaceRequest request)
    {
        try
        {
            // Validar que el nombre del espacio no exista
            var existingSpace = await _context.Spaces
                .FirstOrDefaultAsync(s => s.Name.ToLower() == request.Name.ToLower() && s.IsActive);

            if (existingSpace != null)
            {
                return BadRequest(new { error = "Ya existe un espacio con ese nombre" });
            }

            var space = new Space
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim(),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Spaces.Add(space);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Espacio creado: {SpaceId} - {SpaceName}", space.Id, space.Name);
            return CreatedAtAction(nameof(GetSpace), new { id = space.Id }, space);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear espacio");
            return StatusCode(500, new { error = "Error al crear el espacio", details = ex.Message });
        }
    }

    /// <summary>
    /// Elimina un espacio y todas sus mesas (solo si todas las mesas están disponibles)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSpace(int id)
    {
        try
        {
            var space = await _context.Spaces
                .Include(s => s.Tables.Where(t => t.IsActive))
                .FirstOrDefaultAsync(s => s.Id == id);

            if (space == null)
            {
                return NotFound(new { error = "Espacio no encontrado" });
            }

            // Verificar que todas las mesas del espacio estén disponibles
            var tablesWithNonAvailableStatus = space.Tables
                .Where(t => t.IsActive && t.Status != "Available")
                .ToList();

            if (tablesWithNonAvailableStatus.Any())
            {
                var tableNumbers = string.Join(", ", tablesWithNonAvailableStatus.Select(t => t.Number));
                return BadRequest(new { 
                    error = $"No se puede eliminar el espacio porque tiene mesas que no están disponibles: {tableNumbers}" 
                });
            }

            // Verificar que no haya pedidos activos en las mesas del espacio
            var tableIds = space.Tables.Where(t => t.IsActive).Select(t => t.Id).ToList();
            if (tableIds.Any())
            {
                var hasActiveOrders = await _context.Orders
                    .AnyAsync(o => tableIds.Contains(o.TableId ?? 0)
                        && !o.IsArchived
                        && (o.Status == "Pending" || o.Status == "Preparing" || o.Status == "Ready"));

                if (hasActiveOrders)
                {
                    return BadRequest(new { error = "No se puede eliminar el espacio porque tiene mesas con pedidos activos" });
                }
            }

            // Eliminar (desactivar) todas las mesas del espacio
            foreach (var table in space.Tables.Where(t => t.IsActive))
            {
                table.IsActive = false;
                table.UpdatedAt = DateTime.UtcNow;
            }

            // Soft delete - solo desactivar el espacio
            space.IsActive = false;
            space.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Espacio eliminado (desactivado): {SpaceId} - {SpaceName} con {TableCount} mesas", 
                space.Id, space.Name, space.Tables.Count);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar espacio");
            return StatusCode(500, new { error = "Error al eliminar el espacio", details = ex.Message });
        }
    }
}

// DTOs
public class CreateSpaceRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

