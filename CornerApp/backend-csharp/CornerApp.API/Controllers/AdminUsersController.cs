using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;
using BCrypt.Net;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para gestión de usuarios administradores
/// </summary>
[ApiController]
[Route("admin/api/users")]
[Tags("Administración - Usuarios")]
[Authorize(Roles = "Admin")] // Solo Admin puede gestionar usuarios
public class AdminUsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminUsersController> _logger;

    public AdminUsersController(
        ApplicationDbContext context,
        ILogger<AdminUsersController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene la lista de todos los usuarios administradores
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetUsers([FromQuery] string? search = null)
    {
        try
        {
            var query = _context.Admins.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(a => 
                    a.Username.ToLower().Contains(searchLower) ||
                    a.Email.ToLower().Contains(searchLower) ||
                    a.Name.ToLower().Contains(searchLower));
            }

            var users = await query
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new
                {
                    id = a.Id,
                    username = a.Username,
                    email = a.Email,
                    name = a.Name,
                    role = a.Role ?? "Employee",
                    createdAt = a.CreatedAt,
                    updatedAt = a.UpdatedAt,
                    lastLoginAt = a.LastLoginAt
                })
                .ToListAsync();

            return Ok(new
            {
                data = users,
                total = users.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener usuarios administradores");
            return StatusCode(500, new { error = "Error al obtener usuarios", details = ex.Message });
        }
    }

    /// <summary>
    /// Obtiene un usuario administrador por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult> GetUser(int id)
    {
        try
        {
            var user = await _context.Admins
                .Where(a => a.Id == id)
                .Select(a => new
                {
                    id = a.Id,
                    username = a.Username,
                    email = a.Email,
                    name = a.Name,
                    role = a.Role ?? "Employee",
                    createdAt = a.CreatedAt,
                    updatedAt = a.UpdatedAt,
                    lastLoginAt = a.LastLoginAt
                })
                .FirstOrDefaultAsync();

            if (user == null)
            {
                return NotFound(new { error = "Usuario no encontrado" });
            }

            return Ok(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener usuario {UserId}", id);
            return StatusCode(500, new { error = "Error al obtener usuario", details = ex.Message });
        }
    }

    /// <summary>
    /// Crea un nuevo usuario administrador
    /// </summary>
    [HttpPost]
    public async Task<ActionResult> CreateUser([FromBody] CreateAdminUserRequest request)
    {
        try
        {
            // Validar entrada
            if (string.IsNullOrWhiteSpace(request.Username))
            {
                return BadRequest(new { error = "El nombre de usuario es requerido" });
            }

            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { error = "El email es requerido" });
            }

            if (string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { error = "La contraseña es requerida" });
            }

            if (request.Password.Length < 6)
            {
                return BadRequest(new { error = "La contraseña debe tener al menos 6 caracteres" });
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { error = "El nombre es requerido" });
            }

            // Verificar si el usuario ya existe
            var usernameLower = request.Username.ToLower();
            var emailLower = request.Email.ToLower();

            var existingUser = await _context.Admins
                .FirstOrDefaultAsync(a => 
                    a.Username.ToLower() == usernameLower || 
                    a.Email.ToLower() == emailLower);

            if (existingUser != null)
            {
                return BadRequest(new { error = "El usuario o email ya está registrado" });
            }

            // Hashear la contraseña
            var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

            // Validar rol
            var role = request.Role?.Trim() ?? "Employee";
            if (role != "Admin" && role != "Employee")
            {
                return BadRequest(new { error = "El rol debe ser 'Admin' o 'Employee'" });
            }

            // Solo Admin puede crear otros Admin
            if (role == "Admin" && !User.IsInRole("Admin"))
            {
                return Forbid("Solo los administradores pueden crear usuarios con rol Admin");
            }

            // Crear nuevo usuario
            var admin = new Admin
            {
                Username = request.Username.Trim(),
                Email = request.Email.Trim().ToLower(),
                Name = request.Name.Trim(),
                PasswordHash = passwordHash,
                Role = role,
                CreatedAt = DateTime.UtcNow
            };

            _context.Admins.Add(admin);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Usuario administrador creado: {Username} (ID: {AdminId}) por {CreatedBy}",
                admin.Username, admin.Id, User.Identity?.Name ?? "Admin");

            return Ok(new
            {
                id = admin.Id,
                username = admin.Username,
                email = admin.Email,
                name = admin.Name,
                role = admin.Role,
                createdAt = admin.CreatedAt,
                message = "Usuario creado exitosamente"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear usuario administrador");
            return StatusCode(500, new { error = "Error al crear usuario", details = ex.Message });
        }
    }

    /// <summary>
    /// Actualiza un usuario administrador
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateUser(int id, [FromBody] UpdateAdminUserRequest request)
    {
        try
        {
            var admin = await _context.Admins.FindAsync(id);
            if (admin == null)
            {
                return NotFound(new { error = "Usuario no encontrado" });
            }

            // Validar email si se proporciona
            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                var emailLower = request.Email.ToLower();
                var existingUser = await _context.Admins
                    .FirstOrDefaultAsync(a => a.Id != id && a.Email.ToLower() == emailLower);

                if (existingUser != null)
                {
                    return BadRequest(new { error = "El email ya está en uso" });
                }

                admin.Email = request.Email.Trim().ToLower();
            }

            // Actualizar campos
            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                admin.Name = request.Name.Trim();
            }

            // Actualizar rol si se proporciona (solo Admin puede cambiar roles)
            if (!string.IsNullOrWhiteSpace(request.Role))
            {
                if (request.Role != "Admin" && request.Role != "Employee")
                {
                    return BadRequest(new { error = "El rol debe ser 'Admin' o 'Employee'" });
                }
                
                // Solo Admin puede cambiar roles, y solo Admin puede asignar rol Admin
                if (!User.IsInRole("Admin"))
                {
                    return Forbid("No tienes permisos para cambiar el rol del usuario");
                }
                
                if (request.Role == "Admin" && !User.IsInRole("Admin"))
                {
                    return Forbid("Solo los administradores pueden asignar rol Admin");
                }
                
                admin.Role = request.Role;
            }

            // Actualizar contraseña si se proporciona
            if (!string.IsNullOrWhiteSpace(request.Password))
            {
                if (request.Password.Length < 6)
                {
                    return BadRequest(new { error = "La contraseña debe tener al menos 6 caracteres" });
                }

                admin.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            }

            admin.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Usuario administrador actualizado: {Username} (ID: {AdminId}) por {UpdatedBy}",
                admin.Username, admin.Id, User.Identity?.Name ?? "Admin");

            return Ok(new
            {
                id = admin.Id,
                username = admin.Username,
                email = admin.Email,
                name = admin.Name,
                role = admin.Role,
                updatedAt = admin.UpdatedAt,
                message = "Usuario actualizado exitosamente"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar usuario {UserId}", id);
            return StatusCode(500, new { error = "Error al actualizar usuario", details = ex.Message });
        }
    }

    /// <summary>
    /// Elimina un usuario administrador
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteUser(int id)
    {
        try
        {
            var admin = await _context.Admins.FindAsync(id);
            if (admin == null)
            {
                return NotFound(new { error = "Usuario no encontrado" });
            }

            // No permitir eliminar el propio usuario
            var currentUsername = User.Identity?.Name;
            if (admin.Username == currentUsername)
            {
                return BadRequest(new { error = "No puedes eliminar tu propio usuario" });
            }

            _context.Admins.Remove(admin);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Usuario administrador eliminado: {Username} (ID: {AdminId}) por {DeletedBy}",
                admin.Username, admin.Id, User.Identity?.Name ?? "Admin");

            return Ok(new { message = "Usuario eliminado exitosamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar usuario {UserId}", id);
            return StatusCode(500, new { error = "Error al eliminar usuario", details = ex.Message });
        }
    }
}

/// <summary>
/// Request para crear un usuario administrador
/// </summary>
public class CreateAdminUserRequest
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = "Employee"; // "Admin" o "Employee"
}

/// <summary>
/// Request para actualizar un usuario administrador
/// </summary>
public class UpdateAdminUserRequest
{
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? Name { get; set; }
    public string? Role { get; set; } // "Admin" o "Employee"
}
