using System.Net;
using System.Net.Mail;
using System.Text;
using CornerApp.API.Data;
using CornerApp.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CornerApp.API.Services;

/// <summary>
/// Servicio para envío de emails usando SMTP
/// </summary>
public class EmailService : IEmailService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(
        ApplicationDbContext context,
        IConfiguration configuration, 
        ILogger<EmailService> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    private async Task<EmailConfig?> GetEmailConfigAsync()
    {
        // Primero intentar desde la base de datos
        var dbConfig = await _context.EmailConfigs.FirstOrDefaultAsync();
        if (dbConfig != null && dbConfig.IsEnabled)
        {
            return dbConfig;
        }

        // Fallback a appsettings si no hay configuración en BD o está deshabilitada
        if (dbConfig == null || !dbConfig.IsEnabled)
        {
            var smtpHost = _configuration["Email:Smtp:Host"];
            var fromEmail = _configuration["Email:From:Address"];
            
            if (!string.IsNullOrWhiteSpace(smtpHost) && !string.IsNullOrWhiteSpace(fromEmail))
            {
                return new EmailConfig
                {
                    SmtpHost = smtpHost,
                    SmtpPort = _configuration.GetValue<int>("Email:Smtp:Port", 587),
                    SmtpUsername = _configuration["Email:Smtp:Username"],
                    SmtpPassword = _configuration["Email:Smtp:Password"],
                    SmtpUseSsl = _configuration.GetValue<bool>("Email:Smtp:UseSsl", true),
                    FromEmail = fromEmail,
                    FromName = _configuration["Email:From:Name"] ?? "CornerApp"
                };
            }
        }

        return null;
    }

    public async Task<bool> SendOrderReceiptAsync(Order order)
    {
        // Validar que el pedido tenga email del cliente
        if (string.IsNullOrWhiteSpace(order.CustomerEmail))
        {
            _logger.LogWarning("No se puede enviar recibo del pedido {OrderId}: el cliente no tiene email", order.Id);
            return false;
        }

        // Obtener configuración de email
        var emailConfig = await GetEmailConfigAsync();
        if (emailConfig == null || string.IsNullOrWhiteSpace(emailConfig.SmtpHost) || string.IsNullOrWhiteSpace(emailConfig.FromEmail))
        {
            _logger.LogWarning("Configuración SMTP incompleta o deshabilitada. No se puede enviar email del pedido {OrderId}", order.Id);
            return false;
        }

        try
        {
            var htmlBody = GenerateReceiptHtml(order);
            var subject = $"Recibo de compra - Pedido #{order.Id}";

            using var client = new SmtpClient(emailConfig.SmtpHost, emailConfig.SmtpPort)
            {
                EnableSsl = emailConfig.SmtpUseSsl,
                Credentials = !string.IsNullOrWhiteSpace(emailConfig.SmtpUsername) 
                    ? new NetworkCredential(emailConfig.SmtpUsername, emailConfig.SmtpPassword) 
                    : null
            };

            using var message = new MailMessage
            {
                From = new MailAddress(emailConfig.FromEmail, emailConfig.FromName ?? "CornerApp"),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
                BodyEncoding = Encoding.UTF8,
                SubjectEncoding = Encoding.UTF8
            };

            message.To.Add(order.CustomerEmail);

            await client.SendMailAsync(message);

            _logger.LogInformation("Recibo enviado por email para el pedido {OrderId} a {Email}", 
                order.Id, order.CustomerEmail);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al enviar recibo por email para el pedido {OrderId}", order.Id);
            return false;
        }
    }

    private string GenerateReceiptHtml(Order order)
    {
        var paymentMethodDisplay = GetPaymentMethodDisplay(order.PaymentMethod);
        var itemsHtml = new StringBuilder();
        
        foreach (var item in order.Items)
        {
            itemsHtml.Append($@"
                <tr>
                    <td style=""padding: 12px; border-bottom: 1px solid #e0e0e0;"">{item.ProductName}</td>
                    <td style=""padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;"">{item.Quantity}</td>
                    <td style=""padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;"">${item.UnitPrice:F2}</td>
                    <td style=""padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold;"">${item.Subtotal:F2}</td>
                </tr>");
        }

        return $@"
<!DOCTYPE html>
<html lang=""es"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Recibo de Compra - Pedido #{order.Id}</title>
</head>
<body style=""margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;"">
    <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background-color: #f5f5f5; padding: 20px;"">
        <tr>
            <td align=""center"">
                <table width=""600"" cellpadding=""0"" cellspacing=""0"" style=""background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"">
                    <!-- Header -->
                    <tr>
                        <td style=""background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;"">
                            <h1 style=""color: #ffffff; margin: 0; font-size: 28px;"">Recibo de Compra</h1>
                            <p style=""color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;"">Pedido #{order.Id}</p>
                        </td>
                    </tr>
                    
                    <!-- Order Info -->
                    <tr>
                        <td style=""padding: 30px;"">
                            <table width=""100%"" cellpadding=""0"" cellspacing=""0"">
                                <tr>
                                    <td style=""padding-bottom: 20px;"">
                                        <h2 style=""color: #333333; margin: 0 0 10px 0; font-size: 20px;"">Detalles del Pedido</h2>
                                        <p style=""color: #666666; margin: 5px 0; font-size: 14px;"">
                                            <strong>Fecha:</strong> {order.CreatedAt:dd/MM/yyyy HH:mm}
                                        </p>
                                        <p style=""color: #666666; margin: 5px 0; font-size: 14px;"">
                                            <strong>Estado:</strong> <span style=""color: #4caf50; font-weight: bold;"">Completado</span>
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Customer Info -->
                                <tr>
                                    <td style=""padding: 20px; background-color: #f9f9f9; border-radius: 6px; margin-bottom: 20px;"">
                                        <h3 style=""color: #333333; margin: 0 0 15px 0; font-size: 16px;"">Información del Cliente</h3>
                                        <p style=""color: #666666; margin: 5px 0; font-size: 14px;"">
                                            <strong>Nombre:</strong> {order.CustomerName}
                                        </p>
                                        <p style=""color: #666666; margin: 5px 0; font-size: 14px;"">
                                            <strong>Teléfono:</strong> {order.CustomerPhone}
                                        </p>
                                        <p style=""color: #666666; margin: 5px 0; font-size: 14px;"">
                                            <strong>Dirección:</strong> {order.CustomerAddress}
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Items -->
                                <tr>
                                    <td style=""padding-top: 20px;"">
                                        <h3 style=""color: #333333; margin: 0 0 15px 0; font-size: 16px;"">Productos</h3>
                                        <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse: collapse;"">
                                            <thead>
                                                <tr style=""background-color: #f5f5f5;"">
                                                    <th style=""padding: 12px; text-align: left; border-bottom: 2px solid #ddd; color: #333333; font-size: 14px;"">Producto</th>
                                                    <th style=""padding: 12px; text-align: center; border-bottom: 2px solid #ddd; color: #333333; font-size: 14px;"">Cantidad</th>
                                                    <th style=""padding: 12px; text-align: right; border-bottom: 2px solid #ddd; color: #333333; font-size: 14px;"">Precio Unit.</th>
                                                    <th style=""padding: 12px; text-align: right; border-bottom: 2px solid #ddd; color: #333333; font-size: 14px;"">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {itemsHtml}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                                
                                <!-- Total -->
                                <tr>
                                    <td style=""padding-top: 20px;"">
                                        <table width=""100%"" cellpadding=""0"" cellspacing=""0"">
                                            <tr>
                                                <td style=""text-align: right; padding: 15px; background-color: #f9f9f9; border-radius: 6px;"">
                                                    <p style=""margin: 0; font-size: 18px; color: #333333;"">
                                                        <strong>Total: <span style=""color: #4caf50; font-size: 24px;"">${order.Total:F2}</span></strong>
                                                    </p>
                                                    <p style=""margin: 10px 0 0 0; font-size: 14px; color: #666666;"">
                                                        Método de pago: {paymentMethodDisplay}
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                                {(string.IsNullOrWhiteSpace(order.Comments) ? "" : $@"
                                <!-- Comments -->
                                <tr>
                                    <td style=""padding-top: 20px;"">
                                        <div style=""padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;"">
                                            <p style=""margin: 0; font-size: 14px; color: #856404;"">
                                                <strong>Comentarios:</strong> {order.Comments}
                                            </p>
                                        </div>
                                    </td>
                                </tr>")}
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style=""padding: 20px; text-align: center; background-color: #f9f9f9; border-radius: 0 0 8px 8px;"">
                            <p style=""margin: 0; color: #999999; font-size: 12px;"">
                                Gracias por tu compra. Este es un recibo automático generado por CornerApp.
                            </p>
                            <p style=""margin: 10px 0 0 0; color: #999999; font-size: 12px;"">
                                Si tienes alguna consulta, contáctanos.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    private string GetPaymentMethodDisplay(string paymentMethod)
    {
        return paymentMethod?.ToLower() switch
        {
            "cash" => "Efectivo",
            "pos" => "POS a domicilio",
            "transfer" or "transferencia" => "Transferencia bancaria",
            _ => paymentMethod ?? "No especificado"
        };
    }
}

