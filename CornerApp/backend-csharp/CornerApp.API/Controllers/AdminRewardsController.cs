using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.DTOs;

namespace CornerApp.API.Controllers;

[ApiController]
[Route("admin/api/rewards")]
[Authorize(Roles = "Admin")]
[Tags("Administración - Recompensas")]
public class AdminRewardsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminRewardsController> _logger;

    public AdminRewardsController(ApplicationDbContext context, ILogger<AdminRewardsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Reward>>> GetRewards()
    {
        return await _context.Rewards
            .OrderByDescending(r => r.IsActive)
            .ThenBy(r => r.PointsRequired)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Reward>> GetReward(int id)
    {
        var reward = await _context.Rewards.FindAsync(id);
        if (reward == null) return NotFound();
        return reward;
    }

    [HttpPost]
    public async Task<ActionResult<Reward>> CreateReward([FromBody] CreateRewardRequest request)
    {
        var reward = new Reward
        {
            Name = request.Name,
            Description = request.Description,
            PointsRequired = request.PointsRequired,
            IsActive = request.IsActive,
            DiscountPercentage = request.DiscountPercentage,
            CreatedAt = DateTime.UtcNow
        };

        _context.Rewards.Add(reward);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetReward), new { id = reward.Id }, reward);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<Reward>> UpdateReward(int id, [FromBody] UpdateRewardRequest request)
    {
        var reward = await _context.Rewards.FindAsync(id);
        if (reward == null) return NotFound();

        if (request.Name != null) reward.Name = request.Name;
        if (request.Description != null) reward.Description = request.Description;
        if (request.PointsRequired.HasValue) reward.PointsRequired = request.PointsRequired.Value;
        if (request.IsActive.HasValue) reward.IsActive = request.IsActive.Value;
        if (request.DiscountPercentage.HasValue) reward.DiscountPercentage = request.DiscountPercentage;

        reward.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(reward);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteReward(int id)
    {
        var reward = await _context.Rewards.FindAsync(id);
        if (reward == null) return NotFound();

        _context.Rewards.Remove(reward);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
