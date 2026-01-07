using System.ComponentModel.DataAnnotations;

namespace CornerApp.API.Models;

/// <summary>
/// Configuración de email para envío de recibos
/// </summary>
public class EmailConfig
{
    public int Id { get; set; }
    
    [MaxLength(200)]
    public string? SmtpHost { get; set; }
    
    public int SmtpPort { get; set; } = 587;
    
    public bool SmtpUseSsl { get; set; } = true;
    
    [MaxLength(200)]
    public string? SmtpUsername { get; set; }
    
    [MaxLength(500)]
    public string? SmtpPassword { get; set; } // Encriptado o en texto plano según necesidad
    
    [MaxLength(200)]
    public string? FromEmail { get; set; }
    
    [MaxLength(100)]
    public string? FromName { get; set; } = "CornerApp";
    
    public bool IsEnabled { get; set; } = false;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

