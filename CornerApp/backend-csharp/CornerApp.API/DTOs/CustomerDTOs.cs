namespace CornerApp.API.DTOs;

/// <summary>
/// DTO para crear un cliente
/// </summary>
public class CreateCustomerRequest
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? DefaultAddress { get; set; }
}
