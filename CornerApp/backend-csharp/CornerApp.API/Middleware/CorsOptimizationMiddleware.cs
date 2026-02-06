using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace CornerApp.API.Middleware;

/// <summary>
/// Middleware para optimizar respuestas CORS preflight
/// </summary>
public class CorsOptimizationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CorsOptimizationMiddleware> _logger;
    private readonly IConfiguration _configuration;

    public CorsOptimizationMiddleware(RequestDelegate next, ILogger<CorsOptimizationMiddleware> logger, IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _configuration = configuration;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Dejar que el middleware de CORS de ASP.NET Core maneje las peticiones OPTIONS
        // Este middleware solo agrega optimizaciones adicionales si es necesario
        await _next(context);
    }
}
