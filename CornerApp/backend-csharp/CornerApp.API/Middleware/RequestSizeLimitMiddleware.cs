using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace CornerApp.API.Middleware;

/// <summary>
/// Middleware para validar y limitar el tamaño de requests
/// </summary>
public class RequestSizeLimitMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestSizeLimitMiddleware> _logger;
    private readonly long _maxRequestSizeBytes;

    public RequestSizeLimitMiddleware(
        RequestDelegate next, 
        ILogger<RequestSizeLimitMiddleware> logger,
        IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _maxRequestSizeBytes = configuration.GetValue<long>("RequestLimits:MaxRequestBodySize", 10 * 1024 * 1024);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Validar tamaño del request body si existe
        if (context.Request.ContentLength.HasValue && 
            context.Request.ContentLength.Value > _maxRequestSizeBytes)
        {
            _logger.LogWarning(
                "Request rechazado por tamaño excesivo: {Size} bytes (máximo: {MaxSize} bytes) desde {IpAddress}",
                context.Request.ContentLength.Value,
                _maxRequestSizeBytes,
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown");

            context.Response.StatusCode = 413; // Payload Too Large
            context.Response.ContentType = "application/json";
            
            var errorResponse = new
            {
                success = false,
                message = $"El tamaño del request excede el límite máximo de {_maxRequestSizeBytes / (1024.0 * 1024.0):F2} MB",
                errorCode = "REQUEST_TOO_LARGE",
                maxSizeBytes = _maxRequestSizeBytes,
                requestId = context.Items["RequestId"]?.ToString()
            };

            await context.Response.WriteAsJsonAsync(errorResponse);
            return;
        }

        await _next(context);
    }
}
