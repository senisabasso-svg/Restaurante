namespace CornerApp.API.DTOs;

/// <summary>
/// DTO para canjear puntos
/// </summary>
public class RedeemPointsRequest
{
    public int RewardId { get; set; }
    public string RewardName { get; set; } = string.Empty;
    public int PointsRequired { get; set; }
}
