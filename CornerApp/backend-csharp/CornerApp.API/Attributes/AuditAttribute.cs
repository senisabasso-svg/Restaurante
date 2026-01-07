using CornerApp.API.Helpers;
using CornerApp.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using System.Text.Json;

namespace CornerApp.API.Attributes;

/// <summary>
/// Atributo para registrar automáticamente eventos de auditoría
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class AuditAttribute : Attribute, IAsyncActionFilter
{
    private readonly string _action;
    private readonly string _entityType;
    private readonly bool _logRequest;
    private readonly bool _logResponse;

    public AuditAttribute(string action, string entityType, bool logRequest = false, bool logResponse = false)
    {
        _action = action;
        _entityType = entityType;
        _logRequest = logRequest;
        _logResponse = logResponse;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var auditService = context.HttpContext.RequestServices.GetRequiredService<IAuditService>();
        var executedContext = await next();

        try
        {
            // Obtener ID de entidad si está disponible
            int? entityId = null;
            if (context.ActionArguments.ContainsKey("id") && 
                int.TryParse(context.ActionArguments["id"]?.ToString(), out var parsedId))
            {
                entityId = parsedId;
            }

            // Crear evento de auditoría
            var auditEvent = AuditHelper.CreateEvent(
                context.HttpContext,
                _action,
                _entityType,
                entityId,
                description: $"{_action} on {_entityType} via {context.HttpContext.Request.Method} {context.HttpContext.Request.Path}");

            // Agregar datos adicionales si está habilitado
            if (_logRequest)
            {
                auditEvent.AdditionalData = JsonSerializer.Serialize(new
                {
                    RequestPath = context.HttpContext.Request.Path,
                    RequestMethod = context.HttpContext.Request.Method,
                    RequestQuery = context.HttpContext.Request.QueryString.ToString()
                });
            }

            // Registrar evento
            await auditService.LogAsync(auditEvent);
        }
        catch (Exception ex)
        {
            // No fallar la request si la auditoría falla
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<AuditAttribute>>();
            logger.LogError(ex, "Error al registrar evento de auditoría");
        }
    }
}
