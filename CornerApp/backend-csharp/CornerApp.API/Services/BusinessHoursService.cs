using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;

namespace CornerApp.API.Services;

/// <summary>
/// Servicio para validar horarios de operación del negocio
/// Lee los horarios desde la base de datos (BusinessInfo)
/// </summary>
public class BusinessHoursService : IBusinessHoursService
{
    private readonly ApplicationDbContext _context;
    private readonly TimeSpan _defaultOpeningTime = new TimeSpan(20, 0, 0); // 8:00 PM (default)
    private readonly TimeSpan _defaultClosingTime = new TimeSpan(0, 0, 0); // 12:00 AM (default)
    
    public BusinessHoursService(ApplicationDbContext context)
    {
        _context = context;
    }
    
    private TimeSpan GetOpeningTimeFromDb()
    {
        var businessInfo = _context.BusinessInfo.FirstOrDefault();
        if (businessInfo != null && !string.IsNullOrWhiteSpace(businessInfo.OpeningTime))
        {
            if (TimeSpan.TryParse(businessInfo.OpeningTime, out var openingTime))
            {
                return openingTime;
            }
        }
        return _defaultOpeningTime;
    }
    
    private TimeSpan GetClosingTimeFromDb()
    {
        var businessInfo = _context.BusinessInfo.FirstOrDefault();
        if (businessInfo != null && !string.IsNullOrWhiteSpace(businessInfo.ClosingTime))
        {
            if (TimeSpan.TryParse(businessInfo.ClosingTime, out var closingTime))
            {
                return closingTime;
            }
        }
        return _defaultClosingTime;
    }

    public bool IsWithinOrderHours(DateTime? dateTime = null)
    {
        var now = dateTime ?? DateTime.Now;
        var currentTime = now.TimeOfDay;
        var openingTime = GetOpeningTimeFromDb();
        var closingTime = GetClosingTimeFromDb();
        
        // Si el horario de cierre es medianoche (00:00), significa que cierra a la medianoche del mismo día
        // Si el horario de cierre es menor que el de apertura, significa que cierra al día siguiente
        if (closingTime < openingTime)
        {
            // Cierra al día siguiente (ej: 20:00 a 02:00)
            return currentTime >= openingTime || currentTime < closingTime;
        }
        else
        {
            // Cierra el mismo día (ej: 09:00 a 18:00)
            return currentTime >= openingTime && currentTime < closingTime;
        }
    }

    public TimeSpan GetOpeningTime()
    {
        return GetOpeningTimeFromDb();
    }

    public TimeSpan GetClosingTime()
    {
        return GetClosingTimeFromDb();
    }

    public string GetStatusMessage()
    {
        var now = DateTime.Now;
        var currentTime = now.TimeOfDay;
        var openingTime = GetOpeningTimeFromDb();
        var closingTime = GetClosingTimeFromDb();
        var openingTimeStr = openingTime.ToString(@"hh\:mm");
        var closingTimeStr = closingTime == TimeSpan.Zero ? "12:00 AM" : closingTime.ToString(@"hh\:mm");
        
        if (IsWithinOrderHours(now))
        {
            // Calcular tiempo hasta el cierre
            var timeUntilClose = GetTimeUntilNextChange();
            if (timeUntilClose.HasValue)
            {
                var minutes = (int)timeUntilClose.Value.TotalMinutes;
                if (minutes <= 30)
                {
                    return $"⚠️ Últimos {minutes} minutos para pedir. Cocina cierra a las {closingTimeStr}";
                }
                return $"✅ Estamos abiertos. Pedidos hasta las {closingTimeStr}";
            }
            return $"✅ Estamos abiertos. Pedidos hasta las {closingTimeStr}";
        }
        else
        {
            // Calcular tiempo hasta la apertura
            var timeUntilOpen = GetTimeUntilNextChange();
            if (timeUntilOpen.HasValue)
            {
                var hours = (int)timeUntilOpen.Value.TotalHours;
                var minutes = (int)(timeUntilOpen.Value.TotalMinutes % 60);
                return $"🔒 Cerrado. Abrimos a las {openingTimeStr} (en {hours}h {minutes}m)";
            }
            return $"🔒 Cerrado. Abrimos a las {openingTimeStr}";
        }
    }

    public TimeSpan? GetTimeUntilNextChange()
    {
        var now = DateTime.Now;
        var currentTime = now.TimeOfDay;
        var openingTime = GetOpeningTimeFromDb();
        var closingTime = GetClosingTimeFromDb();
        
        if (IsWithinOrderHours(now))
        {
            // Estamos abiertos, calcular tiempo hasta el cierre
            if (closingTime < openingTime)
            {
                // Cierra al día siguiente
                var tomorrowClosing = now.Date.AddDays(1).Add(closingTime);
                return tomorrowClosing - now;
            }
            else
            {
                // Cierra el mismo día
                var todayClosing = now.Date.Add(closingTime);
                return todayClosing - now;
            }
        }
        else
        {
            // Estamos cerrados, calcular tiempo hasta la apertura
            var todayOpening = now.Date.Add(openingTime);
            
            if (now < todayOpening)
            {
                // Aún no es la hora de apertura de hoy
                return todayOpening - now;
            }
            else
            {
                // Ya pasó la hora de apertura de hoy, la próxima apertura es mañana
                var tomorrowOpening = now.Date.AddDays(1).Add(openingTime);
                return tomorrowOpening - now;
            }
        }
    }
}

