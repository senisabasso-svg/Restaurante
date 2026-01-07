using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Configuration;

namespace CornerApp.API.HealthChecks;

/// <summary>
/// Health check para verificar la disponibilidad de APIs externas
/// </summary>
public class ExternalApiHealthCheck : IHealthCheck
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ExternalApiHealthCheck> _logger;
    private readonly string _apiUrl;
    private readonly int _timeoutSeconds;

    public ExternalApiHealthCheck(
        HttpClient httpClient,
        ILogger<ExternalApiHealthCheck> logger,
        IConfiguration configuration)
    {
        _httpClient = httpClient;
        _logger = logger;
        _apiUrl = configuration.GetValue<string>("HealthChecks:ExternalApi:Url") ?? string.Empty;
        _timeoutSeconds = configuration.GetValue<int>("HealthChecks:ExternalApi:TimeoutSeconds", 5);
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_apiUrl))
        {
            return HealthCheckResult.Healthy("External API health check no configurado (skipped)");
        }

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(_timeoutSeconds));

            var startTime = DateTime.UtcNow;
            var response = await _httpClient.GetAsync(_apiUrl, cts.Token);
            var duration = (DateTime.UtcNow - startTime).TotalMilliseconds;

            var data = new Dictionary<string, object>
            {
                ["Url"] = _apiUrl,
                ["StatusCode"] = (int)response.StatusCode,
                ["ResponseTimeMs"] = Math.Round(duration, 2)
            };

            if (response.IsSuccessStatusCode)
            {
                return HealthCheckResult.Healthy(
                    $"API externa respondió correctamente en {Math.Round(duration, 2)}ms",
                    data: data);
            }

            return HealthCheckResult.Degraded(
                $"API externa respondió con código {response.StatusCode}",
                data: data);
        }
        catch (TaskCanceledException)
        {
            return HealthCheckResult.Unhealthy(
                $"API externa no respondió dentro del timeout de {_timeoutSeconds} segundos",
                data: new Dictionary<string, object> { ["Url"] = _apiUrl, ["TimeoutSeconds"] = _timeoutSeconds });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en health check de API externa");
            return HealthCheckResult.Unhealthy(
                $"Error al verificar API externa: {ex.Message}",
                ex,
                data: new Dictionary<string, object> { ["Url"] = _apiUrl });
        }
    }
}
