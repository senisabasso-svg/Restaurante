using System.Text.Json;

namespace CornerApp.API.Helpers;

/// <summary>
/// Helper para agregar metadata a las respuestas de API
/// </summary>
public static class ResponseMetadataHelper
{
    /// <summary>
    /// Agrega metadata estándar a una respuesta exitosa
    /// </summary>
    public static object AddMetadata<T>(T data, string? message = null, string? requestId = null)
    {
        return new
        {
            success = true,
            message = message ?? "Operación exitosa",
            data = data,
            requestId = requestId,
            timestamp = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Agrega metadata a una respuesta de error
    /// </summary>
    public static object AddErrorMetadata(string message, string? errorCode = null, object? errors = null, string? requestId = null)
    {
        return new
        {
            success = false,
            message = message,
            errorCode = errorCode,
            errors = errors,
            requestId = requestId,
            timestamp = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Agrega metadata a una respuesta paginada
    /// </summary>
    public static object AddPaginationMetadata<T>(
        IEnumerable<T> items,
        int page,
        int pageSize,
        int totalItems,
        string? requestId = null)
    {
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        return new
        {
            success = true,
            message = "Operación exitosa",
            data = items,
            pagination = new
            {
                page = page,
                pageSize = pageSize,
                totalItems = totalItems,
                totalPages = totalPages,
                hasNextPage = page < totalPages,
                hasPreviousPage = page > 1
            },
            requestId = requestId,
            timestamp = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Agrega metadata de performance a una respuesta
    /// </summary>
    public static object AddPerformanceMetadata<T>(
        T data,
        TimeSpan duration,
        string? requestId = null)
    {
        return new
        {
            success = true,
            message = "Operación exitosa",
            data = data,
            performance = new
            {
                durationMs = duration.TotalMilliseconds,
                durationFormatted = FormatDuration(duration)
            },
            requestId = requestId,
            timestamp = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Formatea una duración en formato legible
    /// </summary>
    private static string FormatDuration(TimeSpan duration)
    {
        if (duration.TotalMilliseconds < 1)
        {
            return $"{duration.TotalMicroseconds:F2} μs";
        }
        if (duration.TotalMilliseconds < 1000)
        {
            return $"{duration.TotalMilliseconds:F2} ms";
        }
        if (duration.TotalSeconds < 60)
        {
            return $"{duration.TotalSeconds:F2} s";
        }
        return $"{duration.TotalMinutes:F2} min";
    }
}
