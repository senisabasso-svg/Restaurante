namespace CornerApp.API.Models;

public class DeliveryZoneOptions
{
    public double StoreLatitude { get; set; }
    public double StoreLongitude { get; set; }
    public double MaxDeliveryRadiusKm { get; set; }
    public bool Enabled { get; set; }
}

