using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para configuración del negocio
/// </summary>
[ApiController]
[Route("admin/api")]
[Tags("Administración - Configuración")]
[Authorize(Roles = "Admin")]
public class AdminBusinessController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminBusinessController> _logger;

    public AdminBusinessController(
        ApplicationDbContext context,
        ILogger<AdminBusinessController> logger)
    {
        _context = context;
        _logger = logger;
    }

    #region Business Info

    /// <summary>
    /// Obtiene la información del negocio
    /// </summary>
    [HttpGet("business-info")]
    public async Task<ActionResult<BusinessInfo>> GetBusinessInfo()
    {
        try
        {
            var info = await _context.BusinessInfo.FirstOrDefaultAsync();
            
            if (info == null)
            {
                // Crear registro por defecto si no existe
                info = new BusinessInfo
                {
                    StoreName = "Mi Tienda",
                    Description = "Bienvenido a nuestra tienda",
                    EstimatedDeliveryMinutes = 30,
                    IsOpen = true
                };
                _context.BusinessInfo.Add(info);
                await _context.SaveChangesAsync();
            }

            return Ok(info);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener información del negocio: {Message}", ex.Message);
            _logger.LogError(ex, "Stack trace: {StackTrace}", ex.StackTrace);
            return StatusCode(500, new { error = "Error al obtener información del negocio", message = ex.Message, details = ex.InnerException?.Message });
        }
    }

    /// <summary>
    /// Actualiza la información del negocio
    /// </summary>
    [HttpPut("business-info")]
    public async Task<ActionResult<BusinessInfo>> UpdateBusinessInfo([FromBody] UpdateBusinessInfoRequest request)
    {
        try
        {
            var info = await _context.BusinessInfo.FirstOrDefaultAsync();
            
            if (info == null)
            {
                info = new BusinessInfo();
                _context.BusinessInfo.Add(info);
            }

            // Actualizar campos
            if (request.StoreName != null) info.StoreName = request.StoreName;
            if (request.Description != null) info.Description = request.Description;
            if (request.Address != null) info.Address = request.Address;
            if (request.StoreLatitude.HasValue) info.StoreLatitude = request.StoreLatitude.Value;
            if (request.StoreLongitude.HasValue) info.StoreLongitude = request.StoreLongitude.Value;
            if (request.Phone != null) info.Phone = request.Phone;
            if (request.WhatsApp != null) info.WhatsApp = request.WhatsApp;
            if (request.Email != null) info.Email = request.Email;
            if (request.Instagram != null) info.Instagram = request.Instagram;
            if (request.Facebook != null) info.Facebook = request.Facebook;
            if (request.BusinessHours != null) info.BusinessHours = request.BusinessHours;
            if (request.OpeningTime != null) info.OpeningTime = request.OpeningTime;
            if (request.ClosingTime != null) info.ClosingTime = request.ClosingTime;
            if (request.MinimumOrderAmount.HasValue) info.MinimumOrderAmount = request.MinimumOrderAmount.Value;
            if (request.EstimatedDeliveryMinutes.HasValue) info.EstimatedDeliveryMinutes = request.EstimatedDeliveryMinutes.Value;
            if (request.IsOpen.HasValue) info.IsOpen = request.IsOpen.Value;
            if (request.WelcomeMessage != null) info.WelcomeMessage = request.WelcomeMessage;
            if (request.ClosedMessage != null) info.ClosedMessage = request.ClosedMessage;
            if (request.CityName != null) info.CityName = request.CityName;
            if (request.MinLatitude.HasValue) info.MinLatitude = request.MinLatitude.Value;
            if (request.MaxLatitude.HasValue) info.MaxLatitude = request.MaxLatitude.Value;
            if (request.MinLongitude.HasValue) info.MinLongitude = request.MinLongitude.Value;
            if (request.MaxLongitude.HasValue) info.MaxLongitude = request.MaxLongitude.Value;
            if (request.OrderCompletionWebhookUrl != null) info.OrderCompletionWebhookUrl = request.OrderCompletionWebhookUrl;

            info.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Información del negocio actualizada");
            return Ok(info);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar información del negocio");
            return StatusCode(500, new { error = "Error al actualizar información del negocio" });
        }
    }

    /// <summary>
    /// Cambia el estado de apertura del negocio
    /// </summary>
    [HttpPost("business-info/toggle-open")]
    public async Task<ActionResult> ToggleBusinessOpen()
    {
        try
        {
            var info = await _context.BusinessInfo.FirstOrDefaultAsync();
            
            if (info == null)
            {
                return NotFound(new { error = "Configuración del negocio no encontrada" });
            }

            info.IsOpen = !info.IsOpen;
            info.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { isOpen = info.IsOpen, message = info.IsOpen ? "Negocio abierto" : "Negocio cerrado" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al cambiar estado del negocio");
            return StatusCode(500, new { error = "Error al cambiar estado del negocio" });
        }
    }

    #endregion

    #region Delivery Zone

    /// <summary>
    /// Obtiene la configuración de zona de entrega
    /// </summary>
    [HttpGet("delivery-zone")]
    public async Task<ActionResult<DeliveryZoneConfig>> GetDeliveryZone()
    {
        try
        {
            var zone = await _context.DeliveryZoneConfigs.FirstOrDefaultAsync();
            
            if (zone == null)
            {
                // Crear registro por defecto si no existe
                zone = new DeliveryZoneConfig
                {
                    Name = "Zona Principal",
                    StoreLatitude = -31.3833,
                    StoreLongitude = -57.9667,
                    MaxDeliveryRadiusKm = 5.0,
                    IsEnabled = false
                };
                _context.DeliveryZoneConfigs.Add(zone);
                await _context.SaveChangesAsync();
            }

            return Ok(zone);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener configuración de zona de entrega");
            return StatusCode(500, new { error = "Error al obtener configuración de zona de entrega" });
        }
    }

    /// <summary>
    /// Actualiza la configuración de zona de entrega
    /// </summary>
    [HttpPut("delivery-zone")]
    public async Task<ActionResult<DeliveryZoneConfig>> UpdateDeliveryZone([FromBody] UpdateDeliveryZoneRequest request)
    {
        try
        {
            var zone = await _context.DeliveryZoneConfigs.FirstOrDefaultAsync();
            
            if (zone == null)
            {
                zone = new DeliveryZoneConfig();
                _context.DeliveryZoneConfigs.Add(zone);
            }

            // Actualizar campos
            if (request.Name != null) zone.Name = request.Name;
            if (request.StoreLatitude.HasValue) zone.StoreLatitude = request.StoreLatitude.Value;
            if (request.StoreLongitude.HasValue) zone.StoreLongitude = request.StoreLongitude.Value;
            if (request.MaxDeliveryRadiusKm.HasValue) zone.MaxDeliveryRadiusKm = request.MaxDeliveryRadiusKm.Value;
            if (request.IsEnabled.HasValue) zone.IsEnabled = request.IsEnabled.Value;

            zone.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Configuración de zona de entrega actualizada");
            return Ok(zone);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar configuración de zona de entrega");
            return StatusCode(500, new { error = "Error al actualizar configuración de zona de entrega" });
        }
    }

    #endregion

    #region Email Config

    /// <summary>
    /// Obtiene la configuración de email
    /// </summary>
    [HttpGet("email-config")]
    public async Task<ActionResult<EmailConfig>> GetEmailConfig()
    {
        try
        {
            var config = await _context.EmailConfigs.FirstOrDefaultAsync();
            
            if (config == null)
            {
                // Crear registro por defecto si no existe
                var now = DateTime.UtcNow;
                config = new EmailConfig
                {
                    SmtpPort = 587,
                    SmtpUseSsl = true,
                    FromName = "CornerApp",
                    IsEnabled = false,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                _context.EmailConfigs.Add(config);
                await _context.SaveChangesAsync();
            }

            // No devolver la contraseña en la respuesta
            var response = new
            {
                id = config.Id,
                smtpHost = config.SmtpHost,
                smtpPort = config.SmtpPort,
                smtpUseSsl = config.SmtpUseSsl,
                smtpUsername = config.SmtpUsername,
                fromEmail = config.FromEmail,
                fromName = config.FromName,
                isEnabled = config.IsEnabled,
                hasPassword = !string.IsNullOrWhiteSpace(config.SmtpPassword),
                createdAt = config.CreatedAt,
                updatedAt = config.UpdatedAt
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener configuración de email: {Message}", ex.Message);
            return StatusCode(500, new { error = "Error al obtener configuración de email", details = ex.Message });
        }
    }

    /// <summary>
    /// Actualiza la configuración de email
    /// </summary>
    [HttpPut("email-config")]
    public async Task<ActionResult> UpdateEmailConfig([FromBody] UpdateEmailConfigRequest request)
    {
        try
        {
            var config = await _context.EmailConfigs.FirstOrDefaultAsync();
            
            if (config == null)
            {
                var now = DateTime.UtcNow;
                config = new EmailConfig
                {
                    CreatedAt = now,
                    UpdatedAt = now
                };
                _context.EmailConfigs.Add(config);
            }

            // Actualizar campos
            if (request.SmtpHost != null) config.SmtpHost = request.SmtpHost;
            if (request.SmtpPort.HasValue) config.SmtpPort = request.SmtpPort.Value;
            if (request.SmtpUseSsl.HasValue) config.SmtpUseSsl = request.SmtpUseSsl.Value;
            if (request.SmtpUsername != null) config.SmtpUsername = request.SmtpUsername;
            if (request.SmtpPassword != null) config.SmtpPassword = request.SmtpPassword; // Solo actualizar si se proporciona
            if (request.FromEmail != null) config.FromEmail = request.FromEmail;
            if (request.FromName != null) config.FromName = request.FromName;
            if (request.IsEnabled.HasValue) config.IsEnabled = request.IsEnabled.Value;

            config.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Configuración de email actualizada");

            // Devolver respuesta sin contraseña
            var response = new
            {
                id = config.Id,
                smtpHost = config.SmtpHost,
                smtpPort = config.SmtpPort,
                smtpUseSsl = config.SmtpUseSsl,
                smtpUsername = config.SmtpUsername,
                fromEmail = config.FromEmail,
                fromName = config.FromName,
                isEnabled = config.IsEnabled,
                hasPassword = !string.IsNullOrWhiteSpace(config.SmtpPassword),
                createdAt = config.CreatedAt,
                updatedAt = config.UpdatedAt
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar configuración de email");
            return StatusCode(500, new { error = "Error al actualizar configuración de email" });
        }
    }

    #endregion
}

#region DTOs

public class UpdateBusinessInfoRequest
{
    public string? StoreName { get; set; }
    public string? Description { get; set; }
    public string? Address { get; set; }
    public double? StoreLatitude { get; set; }
    public double? StoreLongitude { get; set; }
    public string? Phone { get; set; }
    public string? WhatsApp { get; set; }
    public string? Email { get; set; }
    public string? Instagram { get; set; }
    public string? Facebook { get; set; }
    public string? BusinessHours { get; set; }
    public string? OpeningTime { get; set; } // Formato HH:mm (ej: "20:00")
    public string? ClosingTime { get; set; } // Formato HH:mm (ej: "00:00")
    public decimal? MinimumOrderAmount { get; set; }
    public int? EstimatedDeliveryMinutes { get; set; }
    public bool? IsOpen { get; set; }
    public string? WelcomeMessage { get; set; }
    public string? ClosedMessage { get; set; }
    public string? CityName { get; set; } // Nombre de la ciudad/región para mensajes y geocodificación
    public double? MinLatitude { get; set; } // Latitud mínima (Sur)
    public double? MaxLatitude { get; set; } // Latitud máxima (Norte)
    public double? MinLongitude { get; set; } // Longitud mínima (Oeste)
    public double? MaxLongitude { get; set; } // Longitud máxima (Este)
    public string? OrderCompletionWebhookUrl { get; set; }
}

public class UpdateDeliveryZoneRequest
{
    public string? Name { get; set; }
    public double? StoreLatitude { get; set; }
    public double? StoreLongitude { get; set; }
    public double? MaxDeliveryRadiusKm { get; set; }
    public bool? IsEnabled { get; set; }
}

public class UpdateEmailConfigRequest
{
    public string? SmtpHost { get; set; }
    public int? SmtpPort { get; set; }
    public bool? SmtpUseSsl { get; set; }
    public string? SmtpUsername { get; set; }
    public string? SmtpPassword { get; set; }
    public string? FromEmail { get; set; }
    public string? FromName { get; set; }
    public bool? IsEnabled { get; set; }
}

#endregion

