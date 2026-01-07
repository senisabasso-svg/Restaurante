namespace CornerApp.API.Models;

public class PaymentMethod
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // Nombre interno (cash, pos, transfer, etc.)
    public string DisplayName { get; set; } = string.Empty; // Nombre para mostrar (Efectivo, POS, etc.)
    public string? Icon { get; set; } // Emoji o icono (💵, 💳, 🏦)
    public string? Description { get; set; } // Descripción opcional
    public bool RequiresReceipt { get; set; } = false; // Si requiere comprobante (ej: transferencia)
    public bool IsActive { get; set; } = true; // Si está activo
    public int DisplayOrder { get; set; } = 0; // Orden de visualización
    
    // Información bancaria (para transferencias, etc.)
    public string? BankName { get; set; } // Nombre del banco
    public string? AccountNumber { get; set; } // Número de cuenta
    public string? AccountHolder { get; set; } // Titular de la cuenta
    public string? AccountType { get; set; } // Tipo: Ahorro, Corriente, etc.
    public string? AccountAlias { get; set; } // Alias o CBU/CLABE
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}


