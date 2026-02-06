using Microsoft.AspNetCore.Http;

namespace CornerApp.API.Middleware;

/// <summary>
/// Middleware para optimizar respuestas CORS preflight
/// </summary>
public class CorsOptimizationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CorsOptimizationMiddleware> _logger;

    public CorsOptimizationMiddleware(RequestDelegate next, ILogger<CorsOptimizationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Dejar que el middleware de CORS de ASP.NET Core maneje las peticiones OPTIONS
        // Este middleware ya no se usa en el pipeline, pero se mantiene por compatibilidad
        await _next(context);
    }
}
