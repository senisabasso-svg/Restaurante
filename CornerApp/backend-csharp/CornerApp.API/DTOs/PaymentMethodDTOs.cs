namespace CornerApp.API.DTOs;

/// <summary>
/// DTO para crear un método de pago
/// </summary>
public class CreatePaymentMethodRequest
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string? Description { get; set; }
    public bool RequiresReceipt { get; set; } = false;
    public bool? IsActive { get; set; }
    public int? DisplayOrder { get; set; }
    
    // Información bancaria
    public string? BankName { get; set; }
    public string? AccountNumber { get; set; }
    public string? AccountHolder { get; set; }
    public string? AccountType { get; set; }
    public string? AccountAlias { get; set; }
}

/// <summary>
/// DTO para actualizar un método de pago
/// </summary>
public class UpdatePaymentMethodRequest
{
    public string? Name { get; set; }
    public string? DisplayName { get; set; }
    public string? Icon { get; set; }
    public string? Description { get; set; }
    public bool? RequiresReceipt { get; set; }
    public bool? IsActive { get; set; }
    public int? DisplayOrder { get; set; }
    
    // Información bancaria
    public string? BankName { get; set; }
    public string? AccountNumber { get; set; }
    public string? AccountHolder { get; set; }
    public string? AccountType { get; set; }
    public string? AccountAlias { get; set; }
}
