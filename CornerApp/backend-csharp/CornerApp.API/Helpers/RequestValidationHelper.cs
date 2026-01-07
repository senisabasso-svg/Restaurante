using Microsoft.AspNetCore.Http;

namespace CornerApp.API.Helpers;

/// <summary>
/// Helper para validaciones adicionales de requests
/// </summary>
public static class RequestValidationHelper
{
    /// <summary>
    /// Valida que el Content-Type sea el esperado
    /// </summary>
    public static (bool IsValid, string? ErrorMessage) ValidateContentType(
        HttpRequest request,
        string expectedContentType)
    {
        var contentType = request.ContentType;
        
        if (string.IsNullOrWhiteSpace(contentType))
        {
            return (false, "Content-Type header es requerido");
        }

        if (!contentType.Contains(expectedContentType, StringComparison.OrdinalIgnoreCase))
        {
            return (false, $"Content-Type debe ser '{expectedContentType}'");
        }

        return (true, null);
    }

    /// <summary>
    /// Valida que el header esté presente y tenga un valor
    /// </summary>
    public static (bool IsValid, string? ErrorMessage) ValidateHeader(
        HttpRequest request,
        string headerName,
        bool required = true)
    {
        if (!request.Headers.ContainsKey(headerName))
        {
            if (required)
            {
                return (false, $"Header '{headerName}' es requerido");
            }
            return (true, null);
        }

        var headerValue = request.Headers[headerName].ToString();
        if (required && string.IsNullOrWhiteSpace(headerValue))
        {
            return (false, $"Header '{headerName}' no puede estar vacío");
        }

        return (true, null);
    }

    /// <summary>
    /// Valida que el método HTTP sea uno de los permitidos
    /// </summary>
    public static (bool IsValid, string? ErrorMessage) ValidateHttpMethod(
        HttpRequest request,
        params string[] allowedMethods)
    {
        var method = request.Method.ToUpperInvariant();
        
        if (!allowedMethods.Contains(method, StringComparer.OrdinalIgnoreCase))
        {
            return (false, $"Método HTTP '{method}' no permitido. Métodos permitidos: {string.Join(", ", allowedMethods)}");
        }

        return (true, null);
    }

    /// <summary>
    /// Valida el tamaño del Content-Length
    /// </summary>
    public static (bool IsValid, string? ErrorMessage) ValidateContentLength(
        HttpRequest request,
        long maxSizeBytes)
    {
        if (!request.ContentLength.HasValue)
        {
            return (true, null); // Sin Content-Length, no hay problema
        }

        if (request.ContentLength.Value > maxSizeBytes)
        {
            var maxSizeMB = maxSizeBytes / (1024.0 * 1024.0);
            return (false, $"El tamaño del contenido ({request.ContentLength.Value} bytes) excede el límite máximo de {maxSizeMB:F2} MB");
        }

        return (true, null);
    }

    /// <summary>
    /// Valida que el User-Agent esté presente
    /// </summary>
    public static (bool IsValid, string? ErrorMessage) ValidateUserAgent(
        HttpRequest request,
        bool required = false)
    {
        var userAgent = request.Headers["User-Agent"].ToString();
        
        if (required && string.IsNullOrWhiteSpace(userAgent))
        {
            return (false, "User-Agent header es requerido");
        }

        return (true, null);
    }

    /// <summary>
    /// Valida que la request tenga un origen válido (para APIs públicas)
    /// </summary>
    public static (bool IsValid, string? ErrorMessage) ValidateOrigin(
        HttpRequest request,
        List<string>? allowedOrigins = null)
    {
        if (allowedOrigins == null || !allowedOrigins.Any())
        {
            return (true, null); // Sin restricciones
        }

        var origin = request.Headers["Origin"].ToString();
        
        if (string.IsNullOrWhiteSpace(origin))
        {
            return (true, null); // Sin Origin header, no hay problema (puede ser same-origin)
        }

        if (!allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
        {
            return (false, $"Origen '{origin}' no permitido");
        }

        return (true, null);
    }

    /// <summary>
    /// Valida que el Accept header sea compatible
    /// </summary>
    public static (bool IsValid, string? ErrorMessage) ValidateAcceptHeader(
        HttpRequest request,
        params string[] supportedMediaTypes)
    {
        var accept = request.Headers["Accept"].ToString();
        
        if (string.IsNullOrWhiteSpace(accept))
        {
            return (true, null); // Sin Accept header, usar default
        }

        // Verificar si alguno de los tipos soportados está en el Accept header
        var acceptTypes = accept.Split(',')
            .Select(t => t.Split(';')[0].Trim())
            .ToList();

        var hasCompatibleType = supportedMediaTypes.Any(supported =>
            acceptTypes.Any(acceptType =>
                acceptType == "*/*" || 
                acceptType == supported ||
                acceptType.StartsWith(supported.Split('/')[0] + "/*")));

        if (!hasCompatibleType)
        {
            return (false, $"Accept header '{accept}' no es compatible. Tipos soportados: {string.Join(", ", supportedMediaTypes)}");
        }

        return (true, null);
    }
}
