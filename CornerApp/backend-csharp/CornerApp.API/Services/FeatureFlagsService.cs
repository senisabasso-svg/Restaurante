using Microsoft.Extensions.Configuration;
using System.Collections.Concurrent;

namespace CornerApp.API.Services;

/// <summary>
/// Implementación de servicio de feature flags
/// </summary>
public class FeatureFlagsService : IFeatureFlagsService
{
    private readonly ILogger<FeatureFlagsService> _logger;
    private readonly IConfiguration _configuration;
    private readonly ConcurrentDictionary<string, FeatureFlagConfig> _features = new();
    private readonly ConcurrentDictionary<string, bool> _cache = new();

    public FeatureFlagsService(ILogger<FeatureFlagsService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
        LoadFromConfiguration();
    }

    public bool IsEnabled(string featureName)
    {
        if (string.IsNullOrWhiteSpace(featureName))
        {
            return false;
        }

        // Verificar cache primero
        if (_cache.TryGetValue(featureName, out var cachedValue))
        {
            return cachedValue;
        }

        // Verificar configuración en memoria
        if (_features.TryGetValue(featureName, out var config))
        {
            var isEnabled = EvaluateFeature(config, null);
            _cache.TryAdd(featureName, isEnabled);
            return isEnabled;
        }

        // Verificar configuración desde appsettings.json
        var configValue = _configuration.GetValue<bool>($"FeatureFlags:{featureName}:Enabled", false);
        _cache.TryAdd(featureName, configValue);
        
        return configValue;
    }

    public bool IsEnabledForUser(string featureName, int? userId)
    {
        if (string.IsNullOrWhiteSpace(featureName))
        {
            return false;
        }

        // Verificar configuración en memoria
        if (_features.TryGetValue(featureName, out var config))
        {
            return EvaluateFeature(config, userId);
        }

        // Verificar configuración desde appsettings.json
        var globalEnabled = _configuration.GetValue<bool>($"FeatureFlags:{featureName}:Enabled", false);
        
        if (!globalEnabled)
        {
            return false;
        }

        // Verificar si el usuario está en la lista permitida
        var allowedUsers = _configuration.GetSection($"FeatureFlags:{featureName}:AllowedUserIds")
            .Get<List<int>>();
        
        if (allowedUsers != null && allowedUsers.Any() && userId.HasValue)
        {
            return allowedUsers.Contains(userId.Value);
        }

        // Verificar percentage rollout
        var percentage = _configuration.GetValue<double?>($"FeatureFlags:{featureName}:PercentageEnabled");
        if (percentage.HasValue && userId.HasValue)
        {
            // Usar userId como seed para consistencia
            var hash = Math.Abs(userId.Value.GetHashCode());
            var normalized = (hash % 100) / 100.0;
            return normalized < percentage.Value;
        }

        return globalEnabled;
    }

    public Dictionary<string, bool> GetAllFeatures()
    {
        var result = new Dictionary<string, bool>();
        
        // Obtener de configuración en memoria
        foreach (var feature in _features)
        {
            result[feature.Key] = EvaluateFeature(feature.Value, null);
        }

        // Obtener de appsettings.json
        var configSection = _configuration.GetSection("FeatureFlags");
        foreach (var section in configSection.GetChildren())
        {
            if (!result.ContainsKey(section.Key))
            {
                var enabled = section.GetValue<bool>("Enabled", false);
                result[section.Key] = enabled;
            }
        }

        return result;
    }

    public void EnableFeature(string featureName)
    {
        if (string.IsNullOrWhiteSpace(featureName))
        {
            return;
        }

        ConfigureFeature(featureName, new FeatureFlagConfig { Enabled = true });
        _logger.LogInformation("Feature flag '{FeatureName}' habilitado", featureName);
    }

    public void DisableFeature(string featureName)
    {
        if (string.IsNullOrWhiteSpace(featureName))
        {
            return;
        }

        ConfigureFeature(featureName, new FeatureFlagConfig { Enabled = false });
        _logger.LogInformation("Feature flag '{FeatureName}' deshabilitado", featureName);
    }

    public void ConfigureFeature(string featureName, FeatureFlagConfig config)
    {
        if (string.IsNullOrWhiteSpace(featureName) || config == null)
        {
            return;
        }

        _features.AddOrUpdate(featureName, config, (key, oldValue) => config);
        _cache.TryRemove(featureName, out _); // Invalidar cache
        _logger.LogInformation("Feature flag '{FeatureName}' configurado: Enabled={Enabled}", 
            featureName, config.Enabled);
    }

    private bool EvaluateFeature(FeatureFlagConfig config, int? userId)
    {
        if (config == null)
        {
            return false;
        }

        // Verificar si está habilitado globalmente
        if (!config.Enabled)
        {
            return false;
        }

        // Verificar rango de fechas
        var now = DateTime.UtcNow;
        if (config.EnabledFrom.HasValue && now < config.EnabledFrom.Value)
        {
            return false;
        }

        if (config.EnabledUntil.HasValue && now > config.EnabledUntil.Value)
        {
            return false;
        }

        // Verificar usuarios permitidos
        if (userId.HasValue && config.AllowedUserIds != null && config.AllowedUserIds.Any())
        {
            return config.AllowedUserIds.Contains(userId.Value);
        }

        // Verificar percentage rollout
        if (config.PercentageEnabled.HasValue && userId.HasValue)
        {
            var hash = Math.Abs(userId.Value.GetHashCode());
            var normalized = (hash % 100) / 100.0;
            return normalized < config.PercentageEnabled.Value;
        }

        return config.Enabled;
    }

    private void LoadFromConfiguration()
    {
        var configSection = _configuration.GetSection("FeatureFlags");
        foreach (var section in configSection.GetChildren())
        {
            var featureName = section.Key;
            var enabled = section.GetValue<bool>("Enabled", false);
            var allowedUsers = section.GetSection("AllowedUserIds").Get<List<int>>();
            var percentage = section.GetValue<double?>("PercentageEnabled");
            var enabledFrom = section.GetValue<DateTime?>("EnabledFrom");
            var enabledUntil = section.GetValue<DateTime?>("EnabledUntil");

            var config = new FeatureFlagConfig
            {
                Enabled = enabled,
                AllowedUserIds = allowedUsers,
                PercentageEnabled = percentage,
                EnabledFrom = enabledFrom,
                EnabledUntil = enabledUntil
            };

            _features.TryAdd(featureName, config);
        }

        _logger.LogInformation("Cargados {Count} feature flags desde configuración", _features.Count);
    }
}
