using CornerApp.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Collections.Concurrent;

namespace CornerApp.API.Services;

/// <summary>
/// Implementación de servicio de auditoría usando memoria y base de datos
/// </summary>
public class AuditService : IAuditService
{
    private readonly ILogger<AuditService> _logger;
    private readonly ApplicationDbContext? _context;
    private readonly IConfiguration _configuration;
    private readonly ConcurrentQueue<AuditEvent> _eventQueue = new();
    private readonly bool _enableDatabaseAudit;
    private readonly bool _enableFileAudit;
    private readonly string? _auditLogPath;

    public AuditService(
        ILogger<AuditService> logger,
        IServiceProvider serviceProvider,
        IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
        
        // Intentar obtener DbContext (puede no estar disponible en algunos contextos)
        try
        {
            _context = serviceProvider.GetService<ApplicationDbContext>();
        }
        catch
        {
            _context = null;
        }

        _enableDatabaseAudit = _configuration.GetValue<bool>("Audit:EnableDatabaseAudit", true);
        _enableFileAudit = _configuration.GetValue<bool>("Audit:EnableFileAudit", false);
        _auditLogPath = _configuration.GetValue<string>("Audit:LogPath");
    }

    public async Task LogAsync(AuditEvent auditEvent)
    {
        if (auditEvent == null)
        {
            return;
        }

        try
        {
            // Agregar a cola para procesamiento asíncrono
            _eventQueue.Enqueue(auditEvent);

            // Logging estructurado
            _logger.LogInformation(
                "Audit: {Action} on {EntityType} (ID: {EntityId}) by User {UserId} at {Timestamp}",
                auditEvent.Action,
                auditEvent.EntityType,
                auditEvent.EntityId,
                auditEvent.UserId,
                auditEvent.Timestamp);

            // Procesar inmediatamente si es posible
            await ProcessEventAsync(auditEvent);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al registrar evento de auditoría");
        }
    }

    public void Log(AuditEvent auditEvent)
    {
        if (auditEvent == null)
        {
            return;
        }

        try
        {
            // Logging síncrono (solo logging, no BD)
            _logger.LogInformation(
                "Audit: {Action} on {EntityType} (ID: {EntityId}) by User {UserId}",
                auditEvent.Action,
                auditEvent.EntityType,
                auditEvent.EntityId,
                auditEvent.UserId);

            // Guardar en archivo si está habilitado
            if (_enableFileAudit && !string.IsNullOrEmpty(_auditLogPath))
            {
                Task.Run(() => WriteToFileAsync(auditEvent));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al registrar evento de auditoría (síncrono)");
        }
    }

    public async Task<List<AuditEvent>> GetEventsAsync(AuditQuery query)
    {
        var events = new List<AuditEvent>();

        // Si hay contexto de BD y está habilitado, buscar en BD
        if (_enableDatabaseAudit && _context != null)
        {
            try
            {
                var dbQuery = _context.Set<AuditEvent>().AsQueryable();

                if (!string.IsNullOrEmpty(query.EntityType))
                {
                    dbQuery = dbQuery.Where(e => e.EntityType == query.EntityType);
                }

                if (query.EntityId.HasValue)
                {
                    dbQuery = dbQuery.Where(e => e.EntityId == query.EntityId);
                }

                if (query.UserId.HasValue)
                {
                    dbQuery = dbQuery.Where(e => e.UserId == query.UserId);
                }

                if (!string.IsNullOrEmpty(query.Action))
                {
                    dbQuery = dbQuery.Where(e => e.Action == query.Action);
                }

                if (query.FromDate.HasValue)
                {
                    dbQuery = dbQuery.Where(e => e.Timestamp >= query.FromDate.Value);
                }

                if (query.ToDate.HasValue)
                {
                    dbQuery = dbQuery.Where(e => e.Timestamp <= query.ToDate.Value);
                }

                var page = query.Page ?? 1;
                var pageSize = query.PageSize ?? 50;

                events = await dbQuery
                    .OrderByDescending(e => e.Timestamp)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener eventos de auditoría desde BD");
            }
        }

        return events;
    }

    public async Task<List<AuditEvent>> GetEventsForEntityAsync(string entityType, int entityId)
    {
        var query = new AuditQuery
        {
            EntityType = entityType,
            EntityId = entityId
        };

        return await GetEventsAsync(query);
    }

    private async Task ProcessEventAsync(AuditEvent auditEvent)
    {
        // Guardar en base de datos si está habilitado
        if (_enableDatabaseAudit && _context != null)
        {
            try
            {
                // Nota: Esto requeriría una tabla AuditEvent en la BD
                // Por ahora, solo logueamos
                // await _context.Set<AuditEvent>().AddAsync(auditEvent);
                // await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al guardar evento de auditoría en BD");
            }
        }

        // Guardar en archivo si está habilitado
        if (_enableFileAudit && !string.IsNullOrEmpty(_auditLogPath))
        {
            await WriteToFileAsync(auditEvent);
        }
    }

    private async Task WriteToFileAsync(AuditEvent auditEvent)
    {
        try
        {
            var logDirectory = Path.GetDirectoryName(_auditLogPath);
            if (!string.IsNullOrEmpty(logDirectory) && !Directory.Exists(logDirectory))
            {
                Directory.CreateDirectory(logDirectory);
            }

            var logLine = $"{auditEvent.Timestamp:yyyy-MM-dd HH:mm:ss.fff} | " +
                         $"{auditEvent.Action} | " +
                         $"{auditEvent.EntityType} | " +
                         $"ID:{auditEvent.EntityId} | " +
                         $"User:{auditEvent.UserId} | " +
                         $"IP:{auditEvent.IpAddress} | " +
                         $"{auditEvent.Description ?? ""}\n";

            await File.AppendAllTextAsync(_auditLogPath ?? "audit.log", logLine);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al escribir evento de auditoría en archivo");
        }
    }
}
