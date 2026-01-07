namespace CornerApp.API.Constants;

/// <summary>
/// Constantes relacionadas con métodos de pago
/// </summary>
public static class PaymentConstants
{
    public const string METHOD_CASH = "cash";
    public const string METHOD_POS = "pos";
    public const string METHOD_TRANSFER = "transfer";

    // Nombres para mostrar
    public const string METHOD_CASH_DISPLAY = "Efectivo";
    public const string METHOD_POS_DISPLAY = "POS a domicilio";
    public const string METHOD_TRANSFER_DISPLAY = "Transferencia";

    // Iconos
    public const string METHOD_CASH_ICON = "💵";
    public const string METHOD_POS_ICON = "💳";
    public const string METHOD_TRANSFER_ICON = "🏦";
}
