namespace CornerApp.API.Services;

/// <summary>
/// Servicio para validar horarios de operación del negocio
/// </summary>
public interface IBusinessHoursService
{
    /// <summary>
    /// Verifica si el negocio está dentro del horario para aceptar pedidos
    /// </summary>
    bool IsWithinOrderHours(DateTime? dateTime = null);
    
    /// <summary>
    /// Obtiene el horario de apertura para pedidos
    /// </summary>
    TimeSpan GetOpeningTime();
    
    /// <summary>
    /// Obtiene el horario de cierre para pedidos
    /// </summary>
    TimeSpan GetClosingTime();
    
    /// <summary>
    /// Obtiene el mensaje apropiado según el horario actual
    /// </summary>
    string GetStatusMessage();
    
    /// <summary>
    /// Obtiene el tiempo restante hasta la apertura o cierre
    /// </summary>
    TimeSpan? GetTimeUntilNextChange();
}

