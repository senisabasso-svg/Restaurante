namespace CornerApp.API.Services;

public interface IDeliveryZoneService
{
    Task<DeliveryZoneValidationResult> ValidateDeliveryZoneAsync(string address);
    double CalculateDistanceKm(double lat1, double lon1, double lat2, double lon2);
    double? GetStoreLatitude();
    double? GetStoreLongitude();
    double GetMaxDeliveryRadiusKm();
    bool IsWithinSaltoUruguay(double latitude, double longitude); // Método síncrono para compatibilidad
    Task<bool> IsWithinGeographicBoundsAsync(double latitude, double longitude); // Método asíncrono recomendado
}

public class DeliveryZoneValidationResult
{
    public bool IsWithinZone { get; set; }
    public double? DistanceKm { get; set; }
    public string? ErrorMessage { get; set; }
    public double? CustomerLatitude { get; set; }
    public double? CustomerLongitude { get; set; }
}

