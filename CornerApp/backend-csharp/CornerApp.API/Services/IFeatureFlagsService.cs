namespace CornerApp.API.Services;

/// <summary>
/// Servicio para gestionar feature flags
/// </summary>
public interface IFeatureFlagsService
{
    /// <summary>
    /// Verifica si una feature está habilitada
    /// </summary>
    bool IsEnabled(string featureName);

    /// <summary>
    /// Verifica si una feature está habilitada para un usuario específico
    /// </summary>
    bool IsEnabledForUser(string featureName, int? userId);

    /// <summary>
    /// Obtiene todas las features y su estado
    /// </summary>
    Dictionary<string, bool> GetAllFeatures();

    /// <summary>
    /// Habilita una feature
    /// </summary>
    void EnableFeature(string featureName);

    /// <summary>
    /// Deshabilita una feature
    /// </summary>
    void DisableFeature(string featureName);

    /// <summary>
    /// Configura una feature con opciones específicas
    /// </summary>
    void ConfigureFeature(string featureName, FeatureFlagConfig config);
}

/// <summary>
/// Configuración de un feature flag
/// </summary>
public class FeatureFlagConfig
{
    public bool Enabled { get; set; }
    public List<int>? AllowedUserIds { get; set; }
    public double? PercentageEnabled { get; set; } // 0.0 a 1.0 (0% a 100%)
    public DateTime? EnabledUntil { get; set; }
    public DateTime? EnabledFrom { get; set; }
}
