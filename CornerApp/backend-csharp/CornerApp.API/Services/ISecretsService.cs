namespace CornerApp.API.Services;

/// <summary>
/// Servicio para gestionar secretos de forma segura desde múltiples fuentes
/// </summary>
public interface ISecretsService
{
    /// <summary>
    /// Obtiene un secreto por su clave
    /// </summary>
    Task<string?> GetSecretAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtiene un secreto por su clave con valor por defecto
    /// </summary>
    Task<string> GetSecretAsync(string key, string defaultValue, CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtiene múltiples secretos por sus claves
    /// </summary>
    Task<Dictionary<string, string?>> GetSecretsAsync(IEnumerable<string> keys, CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifica si un secreto existe
    /// </summary>
    Task<bool> SecretExistsAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtiene el proveedor de secretos actual
    /// </summary>
    string GetProviderName();
}
