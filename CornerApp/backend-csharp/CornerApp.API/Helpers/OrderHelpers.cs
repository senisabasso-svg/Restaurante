using CornerApp.API.Constants;

namespace CornerApp.API.Helpers;

/// <summary>
/// Helpers para operaciones relacionadas con pedidos
/// </summary>
public static class OrderHelpers
{
    /// <summary>
    /// Obtiene el nombre en español del estado de un pedido
    /// </summary>
    public static string GetStatusName(string status)
    {
        return status switch
        {
            OrderConstants.STATUS_PENDING => "Pendiente",
            OrderConstants.STATUS_PREPARING => "Preparando",
            OrderConstants.STATUS_DELIVERING => "En Camino",
            OrderConstants.STATUS_COMPLETED => "Completado",
            OrderConstants.STATUS_CANCELLED => "Cancelado",
            _ => status
        };
    }

    /// <summary>
    /// Obtiene el nombre para mostrar de un método de pago
    /// </summary>
    public static string GetPaymentMethodName(string method, Dictionary<string, string>? paymentMethodsDict = null)
    {
        if (string.IsNullOrWhiteSpace(method))
        {
            return "Efectivo al entregar";
        }

        // Si tenemos un diccionario de métodos de pago, usarlo
        if (paymentMethodsDict != null && paymentMethodsDict.TryGetValue(method.ToLower(), out var displayName))
        {
            return displayName;
        }

        // Fallback a valores por defecto si no hay diccionario
        return method.ToLower() switch
        {
            PaymentConstants.METHOD_CASH => "Efectivo al entregar",
            PaymentConstants.METHOD_POS => "POS a domicilio",
            PaymentConstants.METHOD_TRANSFER => "Transferencia",
            _ => method // Si no se encuentra, devolver el nombre original
        };
    }
}
