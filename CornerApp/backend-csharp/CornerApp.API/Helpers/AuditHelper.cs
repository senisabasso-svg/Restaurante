using CornerApp.API.Services;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using System.Text.Json;

namespace CornerApp.API.Helpers;

/// <summary>
/// Helper para facilitar el registro de eventos de auditoría
/// </summary>
public static class AuditHelper
{
    /// <summary>
    /// Crea un evento de auditoría desde el contexto HTTP
    /// </summary>
    public static AuditEvent CreateEvent(
        HttpContext context,
        string action,
        string entityType,
        int? entityId = null,
        Dictionary<string, object>? oldValues = null,
        Dictionary<string, object>? newValues = null,
        string? description = null)
    {
        var userIdClaim = context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int? userId = null;
        if (int.TryParse(userIdClaim, out var parsedUserId))
        {
            userId = parsedUserId;
        }

        var userName = context.User?.FindFirst(ClaimTypes.Name)?.Value ??
                      context.User?.FindFirst("name")?.Value;

        return new AuditEvent
        {
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            UserId = userId,
            UserName = userName,
            IpAddress = context.Connection.RemoteIpAddress?.ToString(),
            UserAgent = context.Request.Headers["User-Agent"].ToString(),
            OldValues = oldValues,
            NewValues = newValues,
            Description = description,
            RequestId = context.Items["RequestId"]?.ToString(),
            Timestamp = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Serializa valores antiguos y nuevos a JSON
    /// </summary>
    public static string SerializeChanges(object? oldValue, object? newValue)
    {
        try
        {
            var changes = new
            {
                OldValue = oldValue,
                NewValue = newValue
            };
            return JsonSerializer.Serialize(changes);
        }
        catch
        {
            return $"Old: {oldValue}, New: {newValue}";
        }
    }

    /// <summary>
    /// Crea un diccionario de cambios desde dos objetos
    /// </summary>
    public static Dictionary<string, object> CreateChangeDictionary(object? oldObject, object? newObject)
    {
        var changes = new Dictionary<string, object>();

        if (oldObject == null && newObject == null)
        {
            return changes;
        }

        // Implementación simple: serializar ambos objetos
        try
        {
            if (oldObject != null)
            {
                var oldJson = JsonSerializer.Serialize(oldObject);
                changes["OldValue"] = oldJson;
            }

            if (newObject != null)
            {
                var newJson = JsonSerializer.Serialize(newObject);
                changes["NewValue"] = newJson;
            }
        }
        catch
        {
            changes["OldValue"] = oldObject?.ToString() ?? "null";
            changes["NewValue"] = newObject?.ToString() ?? "null";
        }

        return changes;
    }
}
