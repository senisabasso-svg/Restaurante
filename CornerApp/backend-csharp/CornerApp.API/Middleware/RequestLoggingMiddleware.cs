using System.Diagnostics;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using CornerApp.API.Services;

namespace CornerApp.API.Middleware;

/// <summary>
/// Middleware para registrar requests y responses HTTP con información detallada
/// </summary>
public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;
    private readonly IMetricsService? _metricsService;
    private readonly bool _enableRequestLogging;
    private readonly bool _logRequestBody;
    private readonly bool _logResponseBody;
    private readonly int _maxRequestBodyLength;
    private readonly int _maxResponseBodyLength;
    private readonly HashSet<string> _skipPaths;
    private readonly bool _includeRequestIdInResponse;
    private readonly string _requestIdHeaderName;

    public RequestLoggingMiddleware(
        RequestDelegate next, 
        ILogger<RequestLoggingMiddleware> logger,
        IConfiguration configuration,
        IMetricsService? metricsService = null)
    {
        _next = next;
        _logger = logger;
        _metricsService = metricsService;
        
        var loggingConfig = configuration.GetSection("RequestLogging");
        _enableRequestLogging = loggingConfig.GetValue<bool>("EnableRequestLogging", true);
        _logRequestBody = loggingConfig.GetValue<bool>("LogRequestBody", true);
        _logResponseBody = loggingConfig.GetValue<bool>("LogResponseBody", true);
        _maxRequestBodyLength = loggingConfig.GetValue<int>("MaxRequestBodyLength", 1000);
        _maxResponseBodyLength = loggingConfig.GetValue<int>("MaxResponseBodyLength", 500);
        
        var skipPathsArray = loggingConfig.GetSection("SkipPaths").Get<string[]>() ?? Array.Empty<string>();
        _skipPaths = new HashSet<string>(skipPathsArray, StringComparer.OrdinalIgnoreCase);
        
        var apiConfig = configuration.GetSection("Api");
        _includeRequestIdInResponse = apiConfig.GetValue<bool>("IncludeRequestIdInResponse", true);
        _requestIdHeaderName = apiConfig.GetValue<string>("RequestIdHeaderName") ?? "X-Request-Id";
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Si el logging está deshabilitado o la ruta debe ser omitida, continuar sin logging
        if (!_enableRequestLogging || ShouldSkipPath(context.Request.Path))
        {
            await _next(context);
            return;
        }

        var stopwatch = Stopwatch.StartNew();
        var requestId = Guid.NewGuid().ToString("N")[..8]; // ID corto para logs
        context.Items["RequestId"] = requestId;
        
        // Agregar Request ID al header de respuesta para que el cliente pueda correlacionar
        if (_includeRequestIdInResponse)
        {
            context.Response.Headers.Append(_requestIdHeaderName, requestId);
        }

        // Log del request
        await LogRequestAsync(context, requestId);

        // Capturar el response body original solo si necesitamos loguear el response
        Stream? originalBodyStream = null;
        MemoryStream? responseBody = null;
        
        if (_logResponseBody)
        {
            originalBodyStream = context.Response.Body;
            responseBody = new MemoryStream();
            context.Response.Body = responseBody;
        }

        try
        {
            await _next(context);
        }
        finally
        {
            stopwatch.Stop();

            // Log del response
            await LogResponseAsync(context, requestId, stopwatch.ElapsedMilliseconds);

            // Copiar el response body capturado al stream original
            if (_logResponseBody && originalBodyStream != null && responseBody != null)
            {
                responseBody.Seek(0, SeekOrigin.Begin);
                await responseBody.CopyToAsync(originalBodyStream);
                responseBody.Dispose();
            }
        }
    }

    private bool ShouldSkipPath(PathString path)
    {
        var pathValue = path.Value ?? string.Empty;
        return _skipPaths.Contains(pathValue) || 
               _skipPaths.Any(skipPath => path.StartsWithSegments(skipPath, StringComparison.OrdinalIgnoreCase));
    }

    private async Task LogRequestAsync(HttpContext context, string requestId)
    {
        var request = context.Request;
        var method = request.Method;
        var path = request.Path + request.QueryString;
        var ipAddress = GetClientIpAddress(context);
        var userAgent = request.Headers["User-Agent"].ToString();

        // Solo loguear body para métodos POST, PUT, PATCH si está habilitado
        string? requestBody = null;
        if (_logRequestBody && request.ContentLength > 0 && 
            (method == "POST" || method == "PUT" || method == "PATCH"))
        {
            request.EnableBuffering();
            using var reader = new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true);
            requestBody = await reader.ReadToEndAsync();
            request.Body.Position = 0;

            // Limitar tamaño del body en logs
            if (requestBody.Length > _maxRequestBodyLength)
            {
                requestBody = requestBody[.._maxRequestBodyLength] + "... [truncated]";
            }
        }

        _logger.LogInformation(
            "[RequestId: {RequestId}] {Method} {Path} | IP: {IpAddress} | UserAgent: {UserAgent} | Body: {RequestBody}",
            requestId, method, path, ipAddress, userAgent, requestBody ?? "[empty]");
    }

    private async Task LogResponseAsync(HttpContext context, string requestId, long elapsedMs)
    {
        var response = context.Response;
        var statusCode = response.StatusCode;
        var path = context.Request.Path + context.Request.QueryString;

        // Leer el response body solo si está habilitado
        string responseBody = "[not logged]";
        if (_logResponseBody && response.Body.CanSeek)
        {
            response.Body.Seek(0, SeekOrigin.Begin);
            using var reader = new StreamReader(response.Body, Encoding.UTF8, leaveOpen: true);
            responseBody = await reader.ReadToEndAsync();
            response.Body.Seek(0, SeekOrigin.Begin);

            // Limitar tamaño del body en logs
            if (responseBody.Length > _maxResponseBodyLength)
            {
                responseBody = responseBody[.._maxResponseBodyLength] + "... [truncated]";
            }
        }

        // Determinar nivel de log según status code
        var logLevel = statusCode switch
        {
            >= 200 and < 300 => LogLevel.Information,
            >= 300 and < 400 => LogLevel.Information,
            >= 400 and < 500 => LogLevel.Warning,
            >= 500 => LogLevel.Error,
            _ => LogLevel.Information
        };

        _logger.Log(
            logLevel,
            "[RequestId: {RequestId}] {Method} {Path} | Status: {StatusCode} | Elapsed: {ElapsedMs}ms | Response: {ResponseBody}",
            requestId, context.Request.Method, path, statusCode, elapsedMs, responseBody);

        // Registrar métricas si el servicio está disponible
        _metricsService?.RecordRequest(path, context.Request.Method, statusCode, elapsedMs);
        
        if (statusCode >= 400)
        {
            var errorType = statusCode switch
            {
                >= 500 => "ServerError",
                >= 400 and < 500 => "ClientError",
                _ => "Unknown"
            };
            _metricsService?.RecordError(path, context.Request.Method, errorType);
        }
    }

    private static string GetClientIpAddress(HttpContext context)
    {
        // Intentar obtener IP real desde headers (útil cuando hay proxy/load balancer)
        var ipAddress = context.Request.Headers["X-Forwarded-For"].FirstOrDefault()
            ?? context.Request.Headers["X-Real-IP"].FirstOrDefault()
            ?? context.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";

        // Si hay múltiples IPs en X-Forwarded-For, tomar la primera
        if (ipAddress.Contains(','))
        {
            ipAddress = ipAddress.Split(',')[0].Trim();
        }

        return ipAddress;
    }
}
