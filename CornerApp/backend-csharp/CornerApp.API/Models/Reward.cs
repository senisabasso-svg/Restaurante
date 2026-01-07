using System.ComponentModel.DataAnnotations;

namespace CornerApp.API.Models;

public class Reward
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(500)]
    public string? Description { get; set; }
    
    [Required]
    public int PointsRequired { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    // Si es un descuento porcentual
    public decimal? DiscountPercentage { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
