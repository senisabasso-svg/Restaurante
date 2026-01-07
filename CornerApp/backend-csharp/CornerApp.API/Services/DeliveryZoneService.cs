using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Models;
using CornerApp.API.Data;

namespace CornerApp.API.Services;

public class DeliveryZoneService : IDeliveryZoneService
{
    private readonly DeliveryZoneOptions _options;
    private readonly ILogger<DeliveryZoneService> _logger;
    private readonly HttpClient _httpClient;
    private readonly ApplicationDbContext _context;
    private BusinessInfo? _businessInfo;

    public DeliveryZoneService(
        Microsoft.Extensions.Options.IOptions<DeliveryZoneOptions> options,
        ILogger<DeliveryZoneService> logger,
        HttpClient httpClient,
        ApplicationDbContext context)
    {
        _options = options.Value;
        _logger = logger;
        _httpClient = httpClient;
        _context = context;
    }

    /// <summary>
    /// Obtiene la información del negocio desde la base de datos
    /// </summary>
    private async Task<BusinessInfo?> GetBusinessInfoAsync()
    {
        if (_businessInfo == null)
        {
            _businessInfo = await _context.BusinessInfo.AsNoTracking().FirstOrDefaultAsync();
        }
        return _businessInfo;
    }

    /// <summary>
    /// Valida si una dirección está dentro de la zona de delivery
    /// </summary>
    public async Task<DeliveryZoneValidationResult> ValidateDeliveryZoneAsync(string address)
    {
        // Si la validación está deshabilitada, permitir todas las direcciones
        if (!_options.Enabled)
        {
            _logger.LogInformation("Validación de zona deshabilitada, permitiendo pedido");
            return new DeliveryZoneValidationResult
            {
                IsWithinZone = true
            };
        }

        // Validar que la dirección no esté vacía
        if (string.IsNullOrWhiteSpace(address))
        {
            return new DeliveryZoneValidationResult
            {
                IsWithinZone = false,
                ErrorMessage = "La dirección es requerida para validar la zona de delivery"
            };
        }

        try
        {
            // Geocodificar la dirección usando OpenStreetMap Nominatim (gratuito)
            var coordinates = await GeocodeAddressAsync(address);
            
            if (coordinates == null)
            {
                _logger.LogWarning("No se pudo geocodificar la dirección: {Address}", address);
                return new DeliveryZoneValidationResult
                {
                    IsWithinZone = false,
                    ErrorMessage = "No se pudo validar la dirección. Por favor, verifica que la dirección sea correcta."
                };
            }

            // Calcular la distancia desde el negocio hasta la dirección del cliente
            var distanceKm = CalculateDistanceKm(
                _options.StoreLatitude,
                _options.StoreLongitude,
                coordinates.Latitude,
                coordinates.Longitude
            );

            var isWithinZone = distanceKm <= _options.MaxDeliveryRadiusKm;

            _logger.LogInformation(
                "Validación de zona: Dirección {Address} - Distancia: {Distance} km, Radio máximo: {MaxRadius} km, Dentro de zona: {IsWithinZone}",
                address,
                distanceKm.ToString("F2"),
                _options.MaxDeliveryRadiusKm,
                isWithinZone
            );

            return new DeliveryZoneValidationResult
            {
                IsWithinZone = isWithinZone,
                DistanceKm = distanceKm,
                CustomerLatitude = coordinates.Latitude,
                CustomerLongitude = coordinates.Longitude,
                ErrorMessage = isWithinZone 
                    ? null 
                    : $"La dirección está fuera del área de cobertura. Distancia: {distanceKm:F2} km. Radio máximo: {_options.MaxDeliveryRadiusKm} km."
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al validar zona de delivery para dirección: {Address}", address);
            return new DeliveryZoneValidationResult
            {
                IsWithinZone = false,
                ErrorMessage = "Error al validar la dirección. Por favor, intenta nuevamente."
            };
        }
    }

    /// <summary>
    /// Calcula la distancia en kilómetros entre dos puntos usando la fórmula de Haversine
    /// </summary>
    public double CalculateDistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusKm = 6371.0; // Radio de la Tierra en kilómetros

        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        var distance = earthRadiusKm * c;

        return distance;
    }

    /// <summary>
    /// Obtiene la latitud del negocio
    /// </summary>
    public double? GetStoreLatitude()
    {
        // Retornar null si la coordenada es 0 (no configurada)
        return _options.StoreLatitude != 0 ? _options.StoreLatitude : null;
    }

    /// <summary>
    /// Obtiene la longitud del negocio
    /// </summary>
    public double? GetStoreLongitude()
    {
        // Retornar null si la coordenada es 0 (no configurada)
        return _options.StoreLongitude != 0 ? _options.StoreLongitude : null;
    }

    /// <summary>
    /// Obtiene el radio máximo de delivery en kilómetros
    /// </summary>
    public double GetMaxDeliveryRadiusKm()
    {
        return _options.MaxDeliveryRadiusKm;
    }

    /// <summary>
    /// Valida que las coordenadas estén dentro de los límites geográficos configurados
    /// </summary>
    public async Task<bool> IsWithinGeographicBoundsAsync(double latitude, double longitude)
    {
        var businessInfo = await GetBusinessInfoAsync();
        
        // Si no hay configuración, usar valores por defecto de Salto, Uruguay
        var minLatitude = businessInfo?.MinLatitude ?? -31.8;
        var maxLatitude = businessInfo?.MaxLatitude ?? -31.0;
        var minLongitude = businessInfo?.MinLongitude ?? -58.3;
        var maxLongitude = businessInfo?.MaxLongitude ?? -57.5;
        var cityName = businessInfo?.CityName ?? "Salto, Uruguay";

        bool isWithinBounds = latitude >= minLatitude && 
                             latitude <= maxLatitude && 
                             longitude >= minLongitude && 
                             longitude <= maxLongitude;

        if (!isWithinBounds)
        {
            _logger.LogWarning(
                "Coordenadas fuera de los límites de {CityName}: ({Lat}, {Lng}). Límites: Lat [{MinLat}, {MaxLat}], Lon [{MinLon}, {MaxLon}]",
                cityName,
                latitude,
                longitude,
                minLatitude,
                maxLatitude,
                minLongitude,
                maxLongitude
            );
        }

        return isWithinBounds;
    }

    /// <summary>
    /// Valida que las coordenadas estén dentro de los límites geográficos (método síncrono para compatibilidad)
    /// </summary>
    public bool IsWithinSaltoUruguay(double latitude, double longitude)
    {
        // Para compatibilidad con código existente, usar valores por defecto si no hay BusinessInfo cargado
        // En producción, se recomienda usar IsWithinGeographicBoundsAsync
        var businessInfo = _businessInfo ?? _context.BusinessInfo.AsNoTracking().FirstOrDefault();
        
        var minLatitude = businessInfo?.MinLatitude ?? -31.8;
        var maxLatitude = businessInfo?.MaxLatitude ?? -31.0;
        var minLongitude = businessInfo?.MinLongitude ?? -58.3;
        var maxLongitude = businessInfo?.MaxLongitude ?? -57.5;
        var cityName = businessInfo?.CityName ?? "Salto, Uruguay";

        bool isWithinBounds = latitude >= minLatitude && 
                             latitude <= maxLatitude && 
                             longitude >= minLongitude && 
                             longitude <= maxLongitude;

        if (!isWithinBounds)
        {
            _logger.LogWarning(
                "Coordenadas fuera de los límites de {CityName}: ({Lat}, {Lng}). Límites: Lat [{MinLat}, {MaxLat}], Lon [{MinLon}, {MaxLon}]",
                cityName,
                latitude,
                longitude,
                minLatitude,
                maxLatitude,
                minLongitude,
                maxLongitude
            );
        }

        return isWithinBounds;
    }

    private static double DegreesToRadians(double degrees)
    {
        return degrees * Math.PI / 180.0;
    }

    /// <summary>
    /// Geocodifica una dirección usando OpenStreetMap Nominatim API (gratuita)
    /// </summary>
    private async Task<Coordinates?> GeocodeAddressAsync(string address)
    {
        try
        {
            var businessInfo = await GetBusinessInfoAsync();
            var cityName = businessInfo?.CityName ?? "Salto, Uruguay";
            
            // Agregar nombre de ciudad configurado para mejorar la precisión
            var searchQuery = $"{address}, {cityName}";
            var encodedAddress = Uri.EscapeDataString(searchQuery);
            
            // Usar OpenStreetMap Nominatim (API gratuita, sin clave necesaria)
            var url = $"https://nominatim.openstreetmap.org/search?q={encodedAddress}&format=json&limit=1";

            // Crear una nueva request para evitar problemas con headers reutilizados
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("User-Agent", "CornerApp-DeliveryZone/1.0");

            var response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Error al geocodificar dirección: {Address}. Status: {Status}",
                    address,
                    response.StatusCode
                );
                return null;
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            
            if (string.IsNullOrWhiteSpace(responseContent))
            {
                _logger.LogWarning("Respuesta vacía de geocodificación para: {Address}", address);
                return null;
            }

            var results = JsonSerializer.Deserialize<List<NominatimResult>>(responseContent, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (results == null || results.Count == 0)
            {
                _logger.LogWarning("No se encontraron resultados de geocodificación para: {Address}", address);
                return null;
            }

            var firstResult = results[0];
            
            if (double.TryParse(firstResult.Lat, out var lat) && double.TryParse(firstResult.Lon, out var lon))
            {
                _logger.LogInformation(
                    "Dirección geocodificada: {Address} -> ({Lat}, {Lon})",
                    address,
                    lat,
                    lon
                );
                
                return new Coordinates { Latitude = lat, Longitude = lon };
            }

            _logger.LogWarning("No se pudieron parsear las coordenadas para: {Address}", address);
            return null;
        }
        catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
        {
            _logger.LogWarning("Timeout al geocodificar dirección: {Address}", address);
            return null;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Error HTTP al geocodificar dirección: {Address}", address);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error inesperado al geocodificar dirección: {Address}", address);
            return null;
        }
    }

    private class NominatimResult
    {
        public string? Lat { get; set; }
        public string? Lon { get; set; }
        public string? Display_Name { get; set; }
    }

    private class Coordinates
    {
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }
}

