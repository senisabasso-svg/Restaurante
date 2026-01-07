using System.ComponentModel.DataAnnotations;

namespace CornerApp.API.DTOs;

public class CreateRewardRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(500)]
    public string? Description { get; set; }
    
    [Required]
    public int PointsRequired { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public decimal? DiscountPercentage { get; set; }
}

public class UpdateRewardRequest
{
    [MaxLength(100)]
    public string? Name { get; set; }
    
    [MaxLength(500)]
    public string? Description { get; set; }
    
    public int? PointsRequired { get; set; }
    
    public bool? IsActive { get; set; }
    
    public decimal? DiscountPercentage { get; set; }
}
