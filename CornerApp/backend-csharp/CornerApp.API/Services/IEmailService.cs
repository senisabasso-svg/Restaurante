using CornerApp.API.Models;

namespace CornerApp.API.Services;

/// <summary>
/// Interfaz para el servicio de envío de emails
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Envía un recibo de compra por email al cliente
    /// </summary>
    /// <param name="order">Pedido completado con todos sus detalles</param>
    /// <returns>True si se envió correctamente, False en caso contrario</returns>
    Task<bool> SendOrderReceiptAsync(Order order);
}

