using Microsoft.Extensions.Configuration;
using System.Text.Json;

namespace CornerApp.API.Middleware;

/// <summary>
/// Middleware para transformar automáticamente las respuestas a formato estándar
/// </summary>
public class ResponseTransformationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ResponseTransformationMiddleware> _logger;
    private readonly ResponseTransformationOptions _options;

    public ResponseTransformationMiddleware(
        RequestDelegate next,
        ILogger<ResponseTransformationMiddleware> logger,
        IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _options = new ResponseTransformationOptions();
        configuration.GetSection("ResponseTransformation").Bind(_options);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Solo transformar si está habilitado
        if (!_options.EnableTransformation)
        {
            await _next(context);
            return;
        }

        // Obtener el stream original de respuesta
        var originalBodyStream = context.Response.Body;

        try
        {
            // Crear un nuevo stream para capturar la respuesta
            using var responseBody = new MemoryStream();
            context.Response.Body = responseBody;

            await _next(context);

            // Leer la respuesta capturada
            responseBody.Seek(0, SeekOrigin.Begin);
            var responseBodyText = await new StreamReader(responseBody).ReadToEndAsync();

            // Verificar si debemos transformar esta respuesta
            if (ShouldTransformResponse(context))
            {
                // Transformar la respuesta
                var transformedResponse = await TransformResponseAsync(
                    context,
                    responseBodyText,
                    context.Response.StatusCode,
                    context.Response.ContentType);

                // Escribir la respuesta transformada
                context.Response.ContentType = "application/json";
                context.Response.ContentLength = null; // Resetear para que se calcule automáticamente

                await using var responseWriter = new StreamWriter(originalBodyStream);
                await responseWriter.WriteAsync(transformedResponse);
            }
            else
            {
                // Copiar la respuesta original sin transformar
                responseBody.Seek(0, SeekOrigin.Begin);
                await responseBody.CopyToAsync(originalBodyStream);
            }
        }
        finally
        {
            context.Response.Body = originalBodyStream;
        }
    }

    private bool ShouldTransformResponse(HttpContext context)
    {
        // No transformar si:
        // 1. Es una respuesta de error (ya tiene formato estándar)
        // 2. Es una respuesta de Swagger
        // 3. Es una respuesta de Health Checks
        // 4. Es una respuesta de archivos estáticos
        // 5. El Content-Type no es JSON
        // 6. Es una respuesta 204 No Content
        // 7. Es una respuesta 304 Not Modified

        var path = context.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;
        
        if (path.Contains("/swagger") || 
            path.Contains("/health") ||
            path.Contains("/metrics") ||
            !context.Response.ContentType?.Contains("application/json") == true ||
            context.Response.StatusCode == 204 ||
            context.Response.StatusCode == 304)
        {
            return false;
        }

        // Verificar si la respuesta ya está en formato estándar
        if (context.Response.Headers.ContainsKey("X-Response-Transformed"))
        {
            return false;
        }

        // Verificar paths excluidos
        if (_options.ExcludedPaths != null && _options.ExcludedPaths.Any(excluded => 
            path.Contains(excluded.ToLowerInvariant())))
        {
            return false;
        }

        return true;
    }

    private Task<string> TransformResponseAsync(
        HttpContext context,
        string originalResponseBody,
        int statusCode,
        string? contentType)
    {
        try
        {
            // Obtener Request ID
            var requestId = context.Items["RequestId"]?.ToString() ?? 
                           context.Response.Headers["X-Request-Id"].ToString();

            // Determinar si es éxito o error
            var isSuccess = statusCode >= 200 && statusCode < 300;

            // Crear respuesta transformada
            var transformedResponse = new
            {
                success = isSuccess,
                message = isSuccess ? "Operación exitosa" : GetDefaultErrorMessage(statusCode),
                data = isSuccess ? ParseJsonIfPossible(originalResponseBody) : null,
                error = !isSuccess ? ParseJsonIfPossible(originalResponseBody) : null,
                statusCode = statusCode,
                requestId = requestId,
                timestamp = DateTime.UtcNow,
                path = context.Request.Path.Value,
                method = context.Request.Method
            };

            // Serializar a JSON
            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false
            };

            var jsonResponse = JsonSerializer.Serialize(transformedResponse, jsonOptions);

            // Agregar header para indicar que fue transformada
            context.Response.Headers.Append("X-Response-Transformed", "true");

            return Task.FromResult(jsonResponse);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al transformar respuesta: {Message}", ex.Message);
            // En caso de error, retornar la respuesta original
            return Task.FromResult(originalResponseBody);
        }
    }

    private object? ParseJsonIfPossible(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<object>(json);
        }
        catch
        {
            // Si no es JSON válido, retornar como string
            return json;
        }
    }

    private string GetDefaultErrorMessage(int statusCode)
    {
        return statusCode switch
        {
            400 => "Solicitud inválida",
            401 => "No autorizado",
            403 => "Acceso prohibido",
            404 => "Recurso no encontrado",
            409 => "Conflicto",
            422 => "Error de validación",
            429 => "Demasiadas solicitudes",
            500 => "Error interno del servidor",
            503 => "Servicio no disponible",
            _ => "Error en la solicitud"
        };
    }
}

/// <summary>
/// Opciones de configuración para Response Transformation
/// </summary>
public class ResponseTransformationOptions
{
    public bool EnableTransformation { get; set; } = false; // Deshabilitado por defecto para no romper compatibilidad
    public List<string>? ExcludedPaths { get; set; } = new List<string> { "/swagger", "/health", "/metrics" };
}
