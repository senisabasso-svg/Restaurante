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
        // Manejar OPTIONS requests (preflight) de manera eficiente
        if (context.Request.Method == "OPTIONS")
        {
            // Agregar headers de CORS optimizados
            var origin = context.Request.Headers["Origin"].ToString();
            
            if (!string.IsNullOrEmpty(origin))
            {
                context.Response.Headers.Append("Access-Control-Allow-Origin", origin);
                context.Response.Headers.Append("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
                context.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id");
                context.Response.Headers.Append("Access-Control-Expose-Headers", "X-Request-Id, ETag, Content-Length");
                context.Response.Headers.Append("Access-Control-Max-Age", "3600");
                
                // Si hay credenciales, agregar el header correspondiente
                if (context.Request.Headers.ContainsKey("Access-Control-Request-Credentials"))
                {
                    context.Response.Headers.Append("Access-Control-Allow-Credentials", "true");
                }
            }
            
            context.Response.StatusCode = 204; // No Content
            await context.Response.CompleteAsync();
            return;
        }

        await _next(context);
    }
}
