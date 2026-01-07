namespace CornerApp.API.Services;

/// <summary>
/// Servicio para registrar eventos de auditoría
/// </summary>
public interface IAuditService
{
    /// <summary>
    /// Registra un evento de auditoría
    /// </summary>
    Task LogAsync(AuditEvent auditEvent);

    /// <summary>
    /// Registra un evento de auditoría de forma síncrona (para casos críticos)
    /// </summary>
    void Log(AuditEvent auditEvent);

    /// <summary>
    /// Obtiene eventos de auditoría por criterios
    /// </summary>
    Task<List<AuditEvent>> GetEventsAsync(AuditQuery query);

    /// <summary>
    /// Obtiene eventos de auditoría para una entidad específica
    /// </summary>
    Task<List<AuditEvent>> GetEventsForEntityAsync(string entityType, int entityId);
}

/// <summary>
/// Evento de auditoría
/// </summary>
public class AuditEvent
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty; // Create, Update, Delete, Login, etc.
    public string EntityType { get; set; } = string.Empty; // Product, Order, Customer, etc.
    public int? EntityId { get; set; }
    public int? UserId { get; set; }
    public string? UserName { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public Dictionary<string, object>? OldValues { get; set; }
    public Dictionary<string, object>? NewValues { get; set; }
    public string? Description { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? RequestId { get; set; }
    public string? AdditionalData { get; set; } // JSON string para datos adicionales
}

/// <summary>
/// Query para buscar eventos de auditoría
/// </summary>
public class AuditQuery
{
    public string? EntityType { get; set; }
    public int? EntityId { get; set; }
    public int? UserId { get; set; }
    public string? Action { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public int? Page { get; set; } = 1;
    public int? PageSize { get; set; } = 50;
}
