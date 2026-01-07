using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace CornerApp.API.Helpers;

/// <summary>
/// Helper para generar y validar ETags
/// </summary>
public static class ETagHelper
{
    /// <summary>
    /// Genera un ETag basado en el contenido de un objeto
    /// </summary>
    public static string GenerateETag(object? data)
    {
        if (data == null)
        {
            return GenerateETagFromString("null");
        }

        try
        {
            // Serializar el objeto a JSON y generar hash
            var json = JsonSerializer.Serialize(data, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false
            });
            
            return GenerateETagFromString(json);
        }
        catch
        {
            // Si falla la serialización, usar el hash del ToString()
            return GenerateETagFromString(data.ToString() ?? "null");
        }
    }

    /// <summary>
    /// Genera un ETag desde una cadena de texto
    /// </summary>
    public static string GenerateETagFromString(string content)
    {
        if (string.IsNullOrEmpty(content))
        {
            content = "empty";
        }

        // Generar hash SHA256 del contenido
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(content));
        var hashString = Convert.ToBase64String(hashBytes);
        
        // ETag debe estar entre comillas y usar formato corto
        // Usar solo los primeros 16 caracteres del hash para mantenerlo corto
        var shortHash = hashString[..Math.Min(16, hashString.Length)];
        return $"\"{shortHash}\"";
    }

    /// <summary>
    /// Genera un ETag basado en una versión o timestamp
    /// </summary>
    public static string GenerateETagFromVersion(string version)
    {
        return GenerateETagFromString(version);
    }

    /// <summary>
    /// Valida si el ETag del cliente coincide con el ETag del servidor
    /// </summary>
    public static bool IsETagValid(string? clientETag, string serverETag)
    {
        if (string.IsNullOrWhiteSpace(clientETag))
        {
            return false;
        }

        // Normalizar ETags (remover comillas si existen)
        var normalizedClient = clientETag.Trim('"');
        var normalizedServer = serverETag.Trim('"');

        return string.Equals(normalizedClient, normalizedServer, StringComparison.Ordinal);
    }

    /// <summary>
    /// Valida si el ETag del cliente es un wildcard (acepta cualquier versión)
    /// </summary>
    public static bool IsWildcardETag(string? clientETag)
    {
        return clientETag == "*";
    }
}
