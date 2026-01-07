namespace CornerApp.API.DTOs;

/// <summary>
/// DTO para crear un repartidor
/// </summary>
public class CreateDeliveryPersonRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

/// <summary>
/// DTO para actualizar un repartidor
/// </summary>
public class UpdateDeliveryPersonRequest
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool? IsActive { get; set; }
}

/// <summary>
/// DTO para inicio de sesión de repartidor
/// </summary>
public class DeliveryPersonLoginRequest
{
    [System.ComponentModel.DataAnnotations.Required(ErrorMessage = "El usuario es requerido")]
    public string Username { get; set; } = string.Empty;
    
    [System.ComponentModel.DataAnnotations.Required(ErrorMessage = "La contraseña es requerida")]
    public string Password { get; set; } = string.Empty;
}

/// <summary>
/// DTO para actualizar ubicación
/// </summary>
public class UpdateLocationRequest
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

/// <summary>
/// DTO para actualizar estado de pedido de repartidor
/// </summary>
public class UpdateDeliveryOrderStatusRequest
{
    public string Status { get; set; } = string.Empty;
}
