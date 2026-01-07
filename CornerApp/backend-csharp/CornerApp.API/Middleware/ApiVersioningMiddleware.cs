using Microsoft.Extensions.Configuration;

namespace CornerApp.API.Middleware;

/// <summary>
/// Middleware para manejar versionado de API mediante headers o query string
/// </summary>
public class ApiVersioningMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ApiVersioningMiddleware> _logger;
    private readonly ApiVersioningOptions _options;

    public ApiVersioningMiddleware(
        RequestDelegate next,
        ILogger<ApiVersioningMiddleware> logger,
        IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _options = new ApiVersioningOptions();
        configuration.GetSection("ApiVersioning").Bind(_options);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Solo procesar si está habilitado
        if (!_options.EnableVersioning)
        {
            await _next(context);
            return;
        }

        // Obtener versión desde header, query string o ruta
        var version = GetApiVersion(context);

        if (!string.IsNullOrEmpty(version))
        {
            // Validar versión
            if (IsValidVersion(version))
            {
                context.Items["ApiVersion"] = version;
                context.Response.Headers.Append("X-API-Version", version);
                _logger.LogDebug("API Version detectada: {Version} para {Path}", version, context.Request.Path);
            }
            else
            {
                _logger.LogWarning("Versión de API inválida: {Version} para {Path}", version, context.Request.Path);
                
                // Retornar error si la versión es inválida
                if (_options.RejectInvalidVersions)
                {
                    context.Response.StatusCode = 400;
                    context.Response.ContentType = "application/json";
                    
                    var errorResponse = new
                    {
                        success = false,
                        message = $"Versión de API inválida: {version}. Versiones soportadas: {string.Join(", ", _options.SupportedVersions ?? new List<string>())}",
                        errorCode = "INVALID_API_VERSION",
                        supportedVersions = _options.SupportedVersions ?? new List<string>(),
                        requestId = context.Items["RequestId"]?.ToString()
                    };

                    await context.Response.WriteAsJsonAsync(errorResponse);
                    return;
                }
            }
        }
        else
        {
            // Usar versión por defecto si no se especifica
            var defaultVersion = _options.DefaultVersion ?? _options.SupportedVersions?.FirstOrDefault() ?? "1.0";
            context.Items["ApiVersion"] = defaultVersion;
            context.Response.Headers.Append("X-API-Version", defaultVersion);
        }

        await _next(context);
    }

    private string? GetApiVersion(HttpContext context)
    {
        // 1. Intentar desde header
        if (_options.VersionHeaderEnabled)
        {
            var headerVersion = context.Request.Headers[_options.VersionHeaderName ?? "X-API-Version"].ToString();
            if (!string.IsNullOrWhiteSpace(headerVersion))
            {
                return headerVersion.Trim();
            }
        }

        // 2. Intentar desde query string
        if (_options.QueryStringEnabled)
        {
            var queryVersion = context.Request.Query[_options.QueryStringParameterName ?? "api-version"].ToString();
            if (!string.IsNullOrWhiteSpace(queryVersion))
            {
                return queryVersion.Trim();
            }
        }

        // 3. Intentar desde ruta (ej: /api/v1/products)
        if (_options.RouteEnabled)
        {
            var path = context.Request.Path.Value ?? string.Empty;
            var match = System.Text.RegularExpressions.Regex.Match(path, @"/v(\d+\.\d+)/");
            if (match.Success)
            {
                return match.Groups[1].Value;
            }
        }

        return null;
    }

    private bool IsValidVersion(string version)
    {
        if (_options.SupportedVersions == null || !_options.SupportedVersions.Any())
        {
            return true; // Si no hay versiones definidas, aceptar cualquier versión
        }

        return _options.SupportedVersions.Contains(version, StringComparer.OrdinalIgnoreCase);
    }
}

/// <summary>
/// Opciones de configuración para API Versioning
/// </summary>
public class ApiVersioningOptions
{
    public bool EnableVersioning { get; set; } = false; // Deshabilitado por defecto
    public List<string>? SupportedVersions { get; set; } = new List<string> { "1.0" };
    public string? DefaultVersion { get; set; } = "1.0";
    public bool RejectInvalidVersions { get; set; } = false;
    public bool VersionHeaderEnabled { get; set; } = true;
    public string? VersionHeaderName { get; set; } = "X-API-Version";
    public bool QueryStringEnabled { get; set; } = true;
    public string? QueryStringParameterName { get; set; } = "api-version";
    public bool RouteEnabled { get; set; } = true;
}
