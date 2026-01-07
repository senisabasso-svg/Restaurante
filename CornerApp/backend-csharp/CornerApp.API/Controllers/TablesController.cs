using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Models;
using CornerApp.API.Data;
using CornerApp.API.DTOs;
using CornerApp.API.Helpers;

namespace CornerApp.API.Controllers;

[ApiController]
[Route("api/tables")]
[Tags("Mesas")]
[Authorize]
public class TablesController : ControllerBase
{
    private readonly ILogger<TablesController> _logger;
    private readonly ApplicationDbContext _context;

    public TablesController(ILogger<TablesController> logger, ApplicationDbContext context)
    {
        _logger = logger;
        _context = context;
    }

    /// <summary>
    /// Obtiene todas las mesas activas
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Table>>> GetTables([FromQuery] string? status = null)
    {
        var query = _context.Tables
            .AsNoTracking()
            .Where(t => t.IsActive);

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(t => t.Status == status);
        }

        var tables = await query
            .Include(t => t.Space)
            .OrderBy(t => t.Number)
            .ToListAsync();

        return Ok(tables);
    }

    /// <summary>
    /// Obtiene una mesa por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<Table>> GetTable(int id)
    {
        var table = await _context.Tables
            .AsNoTracking()
            .Include(t => t.Orders.Where(o => !o.IsArchived))
            .FirstOrDefaultAsync(t => t.Id == id);

        if (table == null)
        {
            return NotFound(new { error = "Mesa no encontrada" });
        }

        return Ok(table);
    }

    /// <summary>
    /// Crea una nueva mesa
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Table>> CreateTable([FromBody] CreateTableRequest request)
    {
        try
        {
            // Validar que el número de mesa no exista
            var existingTable = await _context.Tables
                .FirstOrDefaultAsync(t => t.Number.ToLower() == request.Number.ToLower() && t.IsActive);

            if (existingTable != null)
            {
                return BadRequest(new { error = "Ya existe una mesa con ese número" });
            }

            var table = new Table
            {
                Number = request.Number.Trim(),
                Capacity = request.Capacity,
                Location = request.Location?.Trim(),
                Status = request.Status ?? "Available",
                Notes = request.Notes?.Trim(),
                SpaceId = request.SpaceId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Tables.Add(table);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Mesa creada: {TableId} - {TableNumber}", table.Id, table.Number);
            return CreatedAtAction(nameof(GetTable), new { id = table.Id }, table);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear mesa");
            return StatusCode(500, new { error = "Error al crear la mesa", details = ex.Message });
        }
    }

    /// <summary>
    /// Actualiza una mesa
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<Table>> UpdateTable(int id, [FromBody] UpdateTableRequest request)
    {
        try
        {
            var table = await _context.Tables.FindAsync(id);
            if (table == null)
            {
                return NotFound(new { error = "Mesa no encontrada" });
            }

            // Validar que el número de mesa no exista en otra mesa
            if (!string.IsNullOrEmpty(request.Number))
            {
                var existingTable = await _context.Tables
                    .FirstOrDefaultAsync(t => t.Number.ToLower() == request.Number.ToLower() 
                        && t.Id != id 
                        && t.IsActive);

                if (existingTable != null)
                {
                    return BadRequest(new { error = "Ya existe una mesa con ese número" });
                }

                table.Number = request.Number.Trim();
            }

            if (request.Capacity.HasValue)
            {
                table.Capacity = request.Capacity.Value;
            }

            if (request.Location != null)
            {
                table.Location = request.Location.Trim();
            }

            if (request.SpaceId.HasValue)
            {
                table.SpaceId = request.SpaceId.Value;
            }
            else if (request.SpaceId == null)
            {
                // Permitir establecer SpaceId a null explícitamente
                table.SpaceId = null;
            }

            if (request.PositionX.HasValue)
            {
                table.PositionX = request.PositionX.Value;
            }

            if (request.PositionY.HasValue)
            {
                table.PositionY = request.PositionY.Value;
            }

            if (!string.IsNullOrEmpty(request.Status))
            {
                table.Status = request.Status;
            }

            if (request.Notes != null)
            {
                table.Notes = request.Notes.Trim();
            }

            if (request.IsActive.HasValue)
            {
                table.IsActive = request.IsActive.Value;
            }

            table.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Mesa actualizada: {TableId} - {TableNumber}", table.Id, table.Number);
            return Ok(table);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar mesa");
            return StatusCode(500, new { error = "Error al actualizar la mesa", details = ex.Message });
        }
    }

    /// <summary>
    /// Elimina (desactiva) una mesa
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTable(int id)
    {
        try
        {
            var table = await _context.Tables.FindAsync(id);
            if (table == null)
            {
                return NotFound(new { error = "Mesa no encontrada" });
            }

            // Verificar si hay pedidos activos en esta mesa
            var hasActiveOrders = await _context.Orders
                .AnyAsync(o => o.TableId == id 
                    && !o.IsArchived 
                    && (o.Status == "Pending" || o.Status == "Preparing" || o.Status == "Ready"));

            if (hasActiveOrders)
            {
                return BadRequest(new { error = "No se puede eliminar la mesa porque tiene pedidos activos" });
            }

            // Soft delete - solo desactivar
            table.IsActive = false;
            table.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Mesa eliminada (desactivada): {TableId} - {TableNumber}", table.Id, table.Number);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar mesa");
            return StatusCode(500, new { error = "Error al eliminar la mesa", details = ex.Message });
        }
    }

    /// <summary>
    /// Cambia el estado de una mesa
    /// </summary>
    [HttpPatch("{id}/status")]
    public async Task<ActionResult<Table>> UpdateTableStatus(int id, [FromBody] UpdateTableStatusRequest request)
    {
        try
        {
            var table = await _context.Tables.FindAsync(id);
            if (table == null)
            {
                return NotFound(new { error = "Mesa no encontrada" });
            }

            table.Status = request.Status;
            table.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Estado de mesa actualizado: {TableId} - {TableNumber} -> {Status}", 
                table.Id, table.Number, request.Status);
            return Ok(table);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar estado de mesa");
            return StatusCode(500, new { error = "Error al actualizar el estado de la mesa", details = ex.Message });
        }
    }
}

// DTOs
public class CreateTableRequest
{
    public string Number { get; set; } = string.Empty;
    public int Capacity { get; set; } = 4;
    public string? Location { get; set; }
    public string? Status { get; set; } = "Available";
    public string? Notes { get; set; }
    public int? SpaceId { get; set; }
}

public class UpdateTableRequest
{
    public string? Number { get; set; }
    public int? Capacity { get; set; }
    public string? Location { get; set; }
    public double? PositionX { get; set; }
    public double? PositionY { get; set; }
    public string? Status { get; set; }
    public string? Notes { get; set; }
    public bool? IsActive { get; set; }
    public int? SpaceId { get; set; }
}

public class UpdateTableStatusRequest
{
    public string Status { get; set; } = string.Empty;
}

