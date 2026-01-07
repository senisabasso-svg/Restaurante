using Microsoft.AspNetCore.Http;

namespace CornerApp.API.Helpers;

/// <summary>
/// Helper para trabajar con versiones de API
/// </summary>
public static class ApiVersionHelper
{
    /// <summary>
    /// Obtiene la versión de API del contexto HTTP
    /// </summary>
    public static string GetApiVersion(HttpContext context)
    {
        return context.Items["ApiVersion"]?.ToString() ?? "1.0";
    }

    /// <summary>
    /// Verifica si la versión solicitada es compatible con la versión mínima requerida
    /// </summary>
    public static bool IsVersionCompatible(string requestedVersion, string minimumVersion)
    {
        if (string.IsNullOrWhiteSpace(requestedVersion) || string.IsNullOrWhiteSpace(minimumVersion))
        {
            return false;
        }

        var requested = ParseVersion(requestedVersion);
        var minimum = ParseVersion(minimumVersion);

        if (requested == null || minimum == null)
        {
            return false;
        }

        return requested >= minimum;
    }

    /// <summary>
    /// Compara dos versiones
    /// </summary>
    public static int CompareVersions(string version1, string version2)
    {
        var v1 = ParseVersion(version1);
        var v2 = ParseVersion(version2);

        if (v1 == null && v2 == null) return 0;
        if (v1 == null) return -1;
        if (v2 == null) return 1;

        return v1.CompareTo(v2);
    }

    private static Version? ParseVersion(string versionString)
    {
        if (string.IsNullOrWhiteSpace(versionString))
        {
            return null;
        }

        // Normalizar formato (ej: "1.0" -> "1.0.0")
        var parts = versionString.Split('.');
        if (parts.Length == 2)
        {
            versionString = $"{versionString}.0";
        }

        if (System.Version.TryParse(versionString, out var version))
        {
            return version;
        }

        return null;
    }
}
