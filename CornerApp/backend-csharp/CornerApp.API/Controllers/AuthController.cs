using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.DTOs;
using BCrypt.Net;

namespace CornerApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Tags("Autenticación")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(ApplicationDbContext context, IConfiguration configuration, ILogger<AuthController> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        // Validar entrada
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Email y contraseña son requeridos" });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { error = "El nombre es requerido" });
        }

        if (string.IsNullOrWhiteSpace(request.Phone))
        {
            return BadRequest(new { error = "El teléfono es requerido" });
        }

        if (string.IsNullOrWhiteSpace(request.DefaultAddress))
        {
            return BadRequest(new { error = "La dirección es requerida" });
        }

        // Verificar si el email ya existe (case-insensitive)
        var emailLower = request.Email.ToLower();
        var existingCustomer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Email != null && c.Email.ToLower() == emailLower);

        if (existingCustomer != null)
        {
            return BadRequest(new { error = "Este email ya está registrado" });
        }

        // Hashear la contraseña
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        // Crear nuevo cliente
        var customer = new Customer
        {
            Name = request.Name,
            Email = request.Email.ToLower(),
            Phone = request.Phone ?? string.Empty,
            DefaultAddress = request.DefaultAddress,
            PasswordHash = passwordHash,
            CreatedAt = DateTime.UtcNow
        };

        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();

        // Generar token JWT
        var token = GenerateJwtToken(customer);

        return Ok(new
        {
            token,
            user = new
            {
                id = customer.Id,
                name = customer.Name,
                email = customer.Email,
                phone = customer.Phone,
                defaultAddress = customer.DefaultAddress,
                points = customer.Points
            }
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        // Validar entrada
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Email y contraseña son requeridos" });
        }

        // Buscar cliente por email (case-insensitive)
        var emailLower = request.Email.ToLower();
        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Email != null && c.Email.ToLower() == emailLower);

        if (customer == null)
        {
            return Unauthorized(new { error = "Email o contraseña incorrectos" });
        }

        // Verificar si el cliente tiene contraseña configurada
        if (string.IsNullOrWhiteSpace(customer.PasswordHash))
        {
            return Unauthorized(new { error = "Este usuario no tiene contraseña configurada. Por favor, regístrate nuevamente." });
        }

        // Verificar contraseña
        try
        {
            if (!BCrypt.Net.BCrypt.Verify(request.Password, customer.PasswordHash))
            {
                return Unauthorized(new { error = "Email o contraseña incorrectos" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al autenticar usuario");
            // Si hay un error al verificar la contraseña (hash inválido, etc.)
            return Unauthorized(new { error = "Error al verificar la contraseña. Por favor, contacta al soporte." });
        }

        // Generar token JWT
        var token = GenerateJwtToken(customer);

        return Ok(new
        {
            token,
            user = new
            {
                id = customer.Id,
                name = customer.Name,
                email = customer.Email,
                phone = customer.Phone,
                defaultAddress = customer.DefaultAddress,
                points = customer.Points
            }
        });
    }

    [HttpPost("verify")]
    public async Task<IActionResult> VerifyToken()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { error = "Token inválido" });
        }

        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == userId);

        if (customer == null)
        {
            return Unauthorized(new { error = "Usuario no encontrado" });
        }

        return Ok(new
        {
            user = new
            {
                id = customer.Id,
                name = customer.Name,
                email = customer.Email,
                phone = customer.Phone,
                defaultAddress = customer.DefaultAddress,
                points = customer.Points
            }
        });
    }

    [HttpPut("profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { error = "Token inválido" });
        }

        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == userId);

        if (customer == null)
        {
            return Unauthorized(new { error = "Usuario no encontrado" });
        }

        // Actualizar campos
        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            customer.Name = request.Name.Trim();
        }

        if (request.Phone != null)
        {
            customer.Phone = request.Phone.Trim();
        }

        if (request.DefaultAddress != null)
        {
            customer.DefaultAddress = request.DefaultAddress.Trim();
        }

        customer.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            user = new
            {
                id = customer.Id,
                name = customer.Name,
                email = customer.Email,
                phone = customer.Phone,
                defaultAddress = customer.DefaultAddress,
                points = customer.Points
            }
        });
    }

    [HttpPost("admin/login")]
    [AllowAnonymous]
    public async Task<IActionResult> AdminLogin([FromBody] AdminLoginRequest request)
    {
        // Validar entrada
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Usuario y contraseña son requeridos" });
        }

        // Buscar admin por username (case-insensitive)
        var admin = await _context.Admins
            .FirstOrDefaultAsync(a => a.Username.ToLower() == request.Username.ToLower());

        if (admin == null)
        {
            _logger.LogWarning("Intento de login admin fallido: Usuario no encontrado - {Username}", request.Username);
            return Unauthorized(new { error = "Usuario o contraseña incorrectos" });
        }

        // Verificar contraseña
        try
        {
            if (!BCrypt.Net.BCrypt.Verify(request.Password, admin.PasswordHash))
            {
                _logger.LogWarning("Intento de login admin fallido: Contraseña incorrecta - {Username}", request.Username);
                return Unauthorized(new { error = "Usuario o contraseña incorrectos" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar contraseña de admin");
            return Unauthorized(new { error = "Error al verificar la contraseña. Por favor, contacta al soporte." });
        }

        // Actualizar último login
        admin.LastLoginAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Generar token JWT con rol Admin
        var token = GenerateAdminJwtToken(admin);

        _logger.LogInformation("Admin autenticado exitosamente: {Username} (ID: {AdminId})", admin.Username, admin.Id);

        return Ok(new
        {
            token,
            user = new
            {
                id = admin.Id,
                username = admin.Username,
                email = admin.Email,
                name = admin.Name,
                role = admin.Role ?? "Employee"
            }
        });
    }

    private string GenerateJwtToken(Customer customer)
    {
        // Prioridad: Variable de entorno > appsettings.json > valor por defecto (solo desarrollo)
        var jwtKey = _configuration["JWT_SECRET_KEY"] 
            ?? _configuration["Jwt:Key"] 
            ?? (_configuration.GetValue<string>("ASPNETCORE_ENVIRONMENT") == "Development"
                ? "your-secret-key-that-is-at-least-32-characters-long-for-security-development-only"
                : throw new InvalidOperationException("JWT Secret Key no configurado"));

        var jwtIssuer = _configuration["JWT_ISSUER"] 
            ?? _configuration["Jwt:Issuer"] 
            ?? "CornerApp";

        var jwtAudience = _configuration["JWT_AUDIENCE"] 
            ?? _configuration["Jwt:Audience"] 
            ?? "CornerApp";

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, customer.Id.ToString()),
            new Claim(ClaimTypes.Email, customer.Email),
            new Claim(ClaimTypes.Name, customer.Name)
        };

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30), // Token válido por 30 días
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private string GenerateAdminJwtToken(Admin admin)
    {
        // Prioridad: Variable de entorno > appsettings.json > valor por defecto (solo desarrollo)
        var jwtKey = _configuration["JWT_SECRET_KEY"] 
            ?? _configuration["Jwt:Key"] 
            ?? (_configuration.GetValue<string>("ASPNETCORE_ENVIRONMENT") == "Development"
                ? "your-secret-key-that-is-at-least-32-characters-long-for-security-development-only"
                : throw new InvalidOperationException("JWT Secret Key no configurado"));

        var jwtIssuer = _configuration["JWT_ISSUER"] 
            ?? _configuration["Jwt:Issuer"] 
            ?? "CornerApp";

        var jwtAudience = _configuration["JWT_AUDIENCE"] 
            ?? _configuration["Jwt:Audience"] 
            ?? "CornerApp";

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, admin.Id.ToString()),
            new Claim(ClaimTypes.Email, admin.Email ?? string.Empty),
            new Claim(ClaimTypes.Name, admin.Name),
            new Claim(ClaimTypes.Role, admin.Role ?? "Employee") // Rol del usuario (Admin o Employee)
        };

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7), // Token válido por 7 días para admin
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // Endpoint temporal para crear usuario Admin (SOLO DESARROLLO)
    [HttpPost("admin/create-user")]
    [AllowAnonymous]
    public async Task<IActionResult> CreateAdminUser([FromBody] AdminCreateUserRequest? request)
    {
        var email = request?.Email ?? "berni2384@hotmail.com";
        var password = request?.Password ?? "berni1";
        var name = request?.Name ?? "Berni";

        // Verificar si el usuario ya existe
        var existingAdmin = await _context.Admins
            .FirstOrDefaultAsync(a => a.Username.ToLower() == email.ToLower() || a.Email.ToLower() == email.ToLower());

        if (existingAdmin != null)
        {
            // Actualizar contraseña
            existingAdmin.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
            existingAdmin.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            
            return Ok(new
            {
                message = "Usuario actualizado",
                username = existingAdmin.Username,
                email = existingAdmin.Email
            });
        }

        // Crear nuevo admin
        var admin = new Admin
        {
            Username = email,
            Email = email,
            Name = name,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            CreatedAt = DateTime.UtcNow
        };

        _context.Admins.Add(admin);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Usuario creado exitosamente",
            username = admin.Username,
            email = admin.Email,
            name = admin.Name,
            id = admin.Id
        });
    }
}

// Clase temporal para el endpoint de desarrollo
public class AdminCreateUserRequest
{
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? Name { get; set; }
}

