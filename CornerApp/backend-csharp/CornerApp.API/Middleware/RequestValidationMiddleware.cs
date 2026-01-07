using Microsoft.Extensions.Configuration;

namespace CornerApp.API.Middleware;

/// <summary>
/// Middleware para validar headers y otros aspectos de las requests
/// </summary>
public class RequestValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestValidationMiddleware> _logger;
    private readonly RequestValidationOptions _options;

    public RequestValidationMiddleware(
        RequestDelegate next,
        ILogger<RequestValidationMiddleware> logger,
        IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _options = new RequestValidationOptions();
        configuration.GetSection("RequestValidation").Bind(_options);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Solo validar si está habilitado
        if (!_options.EnableValidation)
        {
            await _next(context);
            return;
        }

        // Validar headers requeridos
        if (_options.RequiredHeaders != null && _options.RequiredHeaders.Any())
        {
            var missingHeaders = new List<string>();
            
            foreach (var requiredHeader in _options.RequiredHeaders)
            {
                if (!context.Request.Headers.ContainsKey(requiredHeader))
                {
                    missingHeaders.Add(requiredHeader);
                }
            }

            if (missingHeaders.Any())
            {
                _logger.LogWarning(
                    "Request rechazada por headers faltantes: {MissingHeaders} desde {IpAddress}",
                    string.Join(", ", missingHeaders),
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown");

                context.Response.StatusCode = 400;
                context.Response.ContentType = "application/json";
                
                var errorResponse = new
                {
                    success = false,
                    message = "Headers requeridos faltantes",
                    errorCode = "MISSING_REQUIRED_HEADERS",
                    missingHeaders = missingHeaders,
                    requestId = context.Items["RequestId"]?.ToString()
                };

                await context.Response.WriteAsJsonAsync(errorResponse);
                return;
            }
        }

        // Validar User-Agent si está habilitado
        if (_options.RequireUserAgent && string.IsNullOrWhiteSpace(context.Request.Headers["User-Agent"].ToString()))
        {
            _logger.LogWarning(
                "Request rechazada por falta de User-Agent desde {IpAddress}",
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown");

            context.Response.StatusCode = 400;
            context.Response.ContentType = "application/json";
            
            var errorResponse = new
            {
                success = false,
                message = "User-Agent header es requerido",
                errorCode = "MISSING_USER_AGENT",
                requestId = context.Items["RequestId"]?.ToString()
            };

            await context.Response.WriteAsJsonAsync(errorResponse);
            return;
        }

        // Validar tamaño de Content-Length si está habilitado
        if (_options.MaxContentLengthBytes > 0 && context.Request.ContentLength.HasValue)
        {
            if (context.Request.ContentLength.Value > _options.MaxContentLengthBytes)
            {
                _logger.LogWarning(
                    "Request rechazada por Content-Length excesivo: {ContentLength} bytes (máximo: {MaxLength} bytes) desde {IpAddress}",
                    context.Request.ContentLength.Value,
                    _options.MaxContentLengthBytes,
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown");

                context.Response.StatusCode = 413; // Payload Too Large
                context.Response.ContentType = "application/json";
                
                var errorResponse = new
                {
                    success = false,
                    message = $"El tamaño del contenido excede el límite máximo de {_options.MaxContentLengthBytes / (1024.0 * 1024.0):F2} MB",
                    errorCode = "CONTENT_TOO_LARGE",
                    maxSizeBytes = _options.MaxContentLengthBytes,
                    requestId = context.Items["RequestId"]?.ToString()
                };

                await context.Response.WriteAsJsonAsync(errorResponse);
                return;
            }
        }

        // Validar métodos HTTP permitidos
        if (_options.AllowedMethods != null && _options.AllowedMethods.Any())
        {
            var method = context.Request.Method.ToUpperInvariant();
            if (!_options.AllowedMethods.Contains(method, StringComparer.OrdinalIgnoreCase))
            {
                _logger.LogWarning(
                    "Request rechazada por método HTTP no permitido: {Method} desde {IpAddress}",
                    method,
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown");

                context.Response.StatusCode = 405; // Method Not Allowed
                context.Response.ContentType = "application/json";
                context.Response.Headers.Append("Allow", string.Join(", ", _options.AllowedMethods));
                
                var errorResponse = new
                {
                    success = false,
                    message = $"Método HTTP '{method}' no permitido",
                    errorCode = "METHOD_NOT_ALLOWED",
                    allowedMethods = _options.AllowedMethods,
                    requestId = context.Items["RequestId"]?.ToString()
                };

                await context.Response.WriteAsJsonAsync(errorResponse);
                return;
            }
        }

        // Validar paths excluidos (skip validation para ciertos paths)
        var path = context.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;
        if (_options.ExcludedPaths != null && _options.ExcludedPaths.Any(excluded => 
            path.Contains(excluded.ToLowerInvariant())))
        {
            await _next(context);
            return;
        }

        await _next(context);
    }
}

/// <summary>
/// Opciones de configuración para Request Validation
/// </summary>
public class RequestValidationOptions
{
    public bool EnableValidation { get; set; } = true;
    public List<string>? RequiredHeaders { get; set; } = new List<string>();
    public bool RequireUserAgent { get; set; } = false;
    public long MaxContentLengthBytes { get; set; } = 0; // 0 = sin límite
    public List<string>? AllowedMethods { get; set; } = null; // null = todos permitidos
    public List<string>? ExcludedPaths { get; set; } = new List<string> { "/swagger", "/health", "/metrics" };
}
