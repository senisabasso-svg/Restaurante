namespace CornerApp.API.DTOs;

/// <summary>
/// DTO para registro de usuario
/// </summary>
public class RegisterRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? DefaultAddress { get; set; }
    public int RestaurantId { get; set; } // ID del restaurante al que pertenece el cliente
}

/// <summary>
/// DTO para inicio de sesión
/// </summary>
public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

/// <summary>
/// DTO para actualizar perfil de usuario
/// </summary>
public class UpdateProfileRequest
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? DefaultAddress { get; set; }
}

/// <summary>
/// DTO para login de administrador (multi-tenant)
/// </summary>
public class AdminLoginRequest
{
    public int? RestaurantId { get; set; } // Opcional para superadmin
    
    [System.ComponentModel.DataAnnotations.Required(ErrorMessage = "El usuario es requerido")]
    public string Username { get; set; } = string.Empty;
    
    [System.ComponentModel.DataAnnotations.Required(ErrorMessage = "La contraseña es requerida")]
    public string Password { get; set; } = string.Empty;
}