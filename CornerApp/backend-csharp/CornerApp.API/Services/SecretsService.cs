using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CornerApp.API.Services;

/// <summary>
/// Servicio para gestionar secretos con soporte para múltiples proveedores
/// </summary>
public class SecretsService : ISecretsService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SecretsService> _logger;
    private readonly string _provider;
    private readonly Dictionary<string, string?> _cache = new();
    private readonly object _cacheLock = new();

    public SecretsService(IConfiguration configuration, ILogger<SecretsService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _provider = DetermineProvider();
        _logger.LogInformation("SecretsService inicializado con proveedor: {Provider}", _provider);
    }

    public async Task<string?> GetSecretAsync(string key, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            throw new ArgumentException("Key no puede estar vacía", nameof(key));
        }

        // Verificar cache primero
        lock (_cacheLock)
        {
            if (_cache.TryGetValue(key, out var cachedValue))
            {
                return cachedValue;
            }
        }

        try
        {
            var value = await RetrieveSecretAsync(key, cancellationToken);
            
            // Cachear el valor
            lock (_cacheLock)
            {
                _cache[key] = value;
            }

            return value;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error al obtener secreto {Key} desde {Provider}, intentando fallback", key, _provider);
            
            // Fallback a configuración estándar
            return _configuration[key] ?? _configuration[$"Secrets:{key}"];
        }
    }

    public async Task<string> GetSecretAsync(string key, string defaultValue, CancellationToken cancellationToken = default)
    {
        var value = await GetSecretAsync(key, cancellationToken);
        return value ?? defaultValue;
    }

    public async Task<Dictionary<string, string?>> GetSecretsAsync(IEnumerable<string> keys, CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<string, string?>();
        var tasks = keys.Select(async key =>
        {
            var value = await GetSecretAsync(key, cancellationToken);
            return new { Key = key, Value = value };
        });

        var results = await Task.WhenAll(tasks);
        foreach (var item in results)
        {
            result[item.Key] = item.Value;
        }

        return result;
    }

    public async Task<bool> SecretExistsAsync(string key, CancellationToken cancellationToken = default)
    {
        var value = await GetSecretAsync(key, cancellationToken);
        return !string.IsNullOrWhiteSpace(value);
    }

    public string GetProviderName() => _provider;

    private string DetermineProvider()
    {
        // Verificar Azure Key Vault
        var keyVaultUri = _configuration["Secrets:AzureKeyVault:VaultUri"];
        if (!string.IsNullOrWhiteSpace(keyVaultUri))
        {
            return "AzureKeyVault";
        }

        // Verificar AWS Secrets Manager
        var awsRegion = _configuration["Secrets:AWS:Region"];
        if (!string.IsNullOrWhiteSpace(awsRegion))
        {
            return "AWSSecretsManager";
        }

        // Verificar si hay variables de entorno con prefijo SECRET_
        var hasSecretEnvVars = Environment.GetEnvironmentVariables()
            .Keys.Cast<string>()
            .Any(k => k.StartsWith("SECRET_", StringComparison.OrdinalIgnoreCase));

        if (hasSecretEnvVars)
        {
            return "EnvironmentVariables";
        }

        // Fallback a Configuration estándar
        return "Configuration";
    }

    private Task<string?> RetrieveSecretAsync(string key, CancellationToken cancellationToken)
    {
        string? result;
        switch (_provider)
        {
            case "AzureKeyVault":
                result = RetrieveFromAzureKeyVault(key);
                break;
            
            case "AWSSecretsManager":
                result = RetrieveFromAWSSecretsManager(key);
                break;
            
            case "EnvironmentVariables":
                result = RetrieveFromEnvironmentVariables(key);
                break;
            
            default:
                result = RetrieveFromConfiguration(key);
                break;
        }
        
        return Task.FromResult(result);
    }

    private string? RetrieveFromAzureKeyVault(string key)
    {
        // Nota: Requiere paquete Azure.Security.KeyVault.Secrets
        // Por ahora, retornamos null para indicar que no está implementado
        // En producción, se implementaría con:
        // var client = new SecretClient(new Uri(vaultUri), credential);
        // var secret = await client.GetSecretAsync(key, cancellationToken);
        // return secret.Value.Value;
        
        _logger.LogWarning("Azure Key Vault no está completamente implementado. Usando fallback.");
        return RetrieveFromConfiguration(key);
    }

    private string? RetrieveFromAWSSecretsManager(string key)
    {
        // Nota: Requiere paquete AWSSDK.SecretsManager
        // Por ahora, retornamos null para indicar que no está implementado
        // En producción, se implementaría con:
        // var client = new AmazonSecretsManagerClient(region);
        // var response = await client.GetSecretValueAsync(new GetSecretValueRequest { SecretId = key }, cancellationToken);
        // return response.SecretString;
        
        _logger.LogWarning("AWS Secrets Manager no está completamente implementado. Usando fallback.");
        return RetrieveFromConfiguration(key);
    }

    private string? RetrieveFromEnvironmentVariables(string key)
    {
        // Buscar con prefijo SECRET_
        var envKey = $"SECRET_{key.ToUpperInvariant()}";
        var value = Environment.GetEnvironmentVariable(envKey);
        
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        // Buscar sin prefijo
        return Environment.GetEnvironmentVariable(key);
    }

    private string? RetrieveFromConfiguration(string key)
    {
        // Intentar desde Secrets: sección
        var secretKey = $"Secrets:{key}";
        var value = _configuration[secretKey];
        
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        // Intentar directamente
        return _configuration[key];
    }

    /// <summary>
    /// Limpia el cache de secretos (útil para testing o rotación de secretos)
    /// </summary>
    public void ClearCache()
    {
        lock (_cacheLock)
        {
            _cache.Clear();
        }
        _logger.LogInformation("Cache de secretos limpiado");
    }
}
