using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.DTOs;

namespace CornerApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Tags("Puntos")]
public class PointsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PointsController> _logger;

    public PointsController(ApplicationDbContext context, ILogger<PointsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene las opciones de canje disponibles
    /// </summary>
    [HttpGet("rewards")]
    public async Task<IActionResult> GetRewards()
    {
        try
        {
            var rewards = await _context.Rewards
                .Where(r => r.IsActive)
                .OrderBy(r => r.PointsRequired)
                .Select(r => new {
                    id = r.Id,
                    name = r.Name,
                    pointsRequired = r.PointsRequired,
                    description = r.Description,
                    discountPercentage = r.DiscountPercentage
                })
                .ToListAsync();

            return Ok(rewards);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener recompensas");
            return StatusCode(500, new { error = "Error al obtener las recompensas" });
        }
    }

    [HttpPost("redeem")]
    public async Task<IActionResult> RedeemPoints([FromBody] RedeemPointsRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { error = "Token inválido" });
        }

        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == userId);

        if (customer == null)
        {
            return Unauthorized(new { error = "Usuario no encontrado" });
        }

        // Obtener la recompensa de la DB para validar
        var reward = await _context.Rewards.FindAsync(request.RewardId);
        if (reward == null || !reward.IsActive)
        {
            return BadRequest(new { error = "La recompensa no está disponible" });
        }

        // Validar que tenga suficientes puntos
        if (customer.Points < reward.PointsRequired)
        {
            return BadRequest(new { error = $"No tienes suficientes puntos. Necesitas {reward.PointsRequired} puntos y tienes {customer.Points}" });
        }

        // Restar puntos
        customer.Points -= reward.PointsRequired;
        customer.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Cliente {CustomerId} canjeó {Points} puntos por {Reward}. Puntos restantes: {RemainingPoints}",
            userId,
            reward.PointsRequired,
            reward.Name,
            customer.Points
        );

        return Ok(new
        {
            success = true,
            message = $"¡Recompensa canjeada exitosamente! Se descontaron {reward.PointsRequired} puntos.",
            remainingPoints = customer.Points,
            reward = new
            {
                id = reward.Id,
                name = reward.Name,
                pointsRequired = reward.PointsRequired,
                discountPercentage = reward.DiscountPercentage
            }
        });
    }

    /// <summary>
    /// Obtiene el historial de canjes del usuario
    /// </summary>
    [HttpGet("history")]
    public Task<IActionResult> GetRedeemHistory()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Task.FromResult<IActionResult>(Unauthorized(new { error = "Token inválido" }));
        }

        // Por ahora retornamos un array vacío, pero se puede implementar un historial en el futuro
        return Task.FromResult<IActionResult>(Ok(new { history = new object[0] }));
    }
}


