using System.Net;
using System.Text.Json;

namespace CornerApp.API.Middleware;

/// <summary>
/// Middleware para manejo global de excepciones
/// </summary>
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IWebHostEnvironment _environment;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IWebHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        var response = context.Response;

        // Obtener RequestId si existe
        var requestId = context.Items["RequestId"]?.ToString();

        var errorResponse = new ErrorResponse
        {
            Success = false,
            Message = "Ha ocurrido un error al procesar la solicitud",
            RequestId = requestId
        };

        switch (exception)
        {
            case ArgumentNullException argNullEx:
                response.StatusCode = (int)HttpStatusCode.BadRequest;
                errorResponse.Message = $"Parámetro requerido faltante: {argNullEx.ParamName}";
                errorResponse.ErrorCode = "ARGUMENT_NULL";
                _logger.LogWarning(exception, "Argumento nulo: {ParamName}", argNullEx.ParamName);
                break;

            case ArgumentException argEx:
                response.StatusCode = (int)HttpStatusCode.BadRequest;
                errorResponse.Message = argEx.Message;
                errorResponse.ErrorCode = "INVALID_ARGUMENT";
                _logger.LogWarning(exception, "Argumento inválido");
                break;

            case UnauthorizedAccessException:
                response.StatusCode = (int)HttpStatusCode.Unauthorized;
                errorResponse.Message = "No autorizado para realizar esta acción";
                errorResponse.ErrorCode = "UNAUTHORIZED";
                _logger.LogWarning(exception, "Acceso no autorizado");
                break;

            case KeyNotFoundException:
                response.StatusCode = (int)HttpStatusCode.NotFound;
                errorResponse.Message = "Recurso no encontrado";
                errorResponse.ErrorCode = "NOT_FOUND";
                _logger.LogWarning(exception, "Recurso no encontrado");
                break;

            case InvalidOperationException invalidOpEx:
                response.StatusCode = (int)HttpStatusCode.BadRequest;
                errorResponse.Message = invalidOpEx.Message;
                errorResponse.ErrorCode = "INVALID_OPERATION";
                _logger.LogWarning(exception, "Operación inválida: {Message}", invalidOpEx.Message);
                break;

            case Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException:
                response.StatusCode = (int)HttpStatusCode.Conflict;
                errorResponse.Message = "El recurso ha sido modificado por otro usuario. Por favor, actualiza y vuelve a intentar";
                errorResponse.ErrorCode = "CONCURRENCY_CONFLICT";
                _logger.LogWarning(exception, "Conflicto de concurrencia");
                break;

            case Microsoft.EntityFrameworkCore.DbUpdateException dbEx:
                response.StatusCode = (int)HttpStatusCode.BadRequest;
                errorResponse.Message = "Error al actualizar la base de datos";
                errorResponse.ErrorCode = "DATABASE_UPDATE_ERROR";
                
                // Detalles específicos de errores de DB comunes
                if (dbEx.InnerException != null)
                {
                    var innerMessage = dbEx.InnerException.Message;
                    if (innerMessage.Contains("UNIQUE constraint"))
                    {
                        errorResponse.Message = "Ya existe un registro con estos datos";
                        errorResponse.ErrorCode = "DUPLICATE_ENTRY";
                    }
                    else if (innerMessage.Contains("FOREIGN KEY constraint"))
                    {
                        errorResponse.Message = "No se puede eliminar porque tiene registros relacionados";
                        errorResponse.ErrorCode = "FOREIGN_KEY_VIOLATION";
                    }
                }
                
                _logger.LogError(exception, "Error de base de datos");
                break;

            default:
                response.StatusCode = (int)HttpStatusCode.InternalServerError;
                errorResponse.Message = _environment.IsDevelopment() 
                    ? exception.Message 
                    : "Ha ocurrido un error interno del servidor";
                errorResponse.ErrorCode = "INTERNAL_SERVER_ERROR";
                _logger.LogError(exception, "Error no manejado: {Message}", exception.Message);
                break;
        }

        // En desarrollo, incluir detalles adicionales
        if (_environment.IsDevelopment())
        {
            errorResponse.Details = new ErrorDetails
            {
                ExceptionType = exception.GetType().Name,
                StackTrace = exception.StackTrace,
                InnerException = exception.InnerException?.Message
            };
        }

        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        var jsonResponse = JsonSerializer.Serialize(errorResponse, options);
        await response.WriteAsync(jsonResponse);
    }
}

/// <summary>
/// Respuesta de error estandarizada
/// </summary>
public class ErrorResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string ErrorCode { get; set; } = string.Empty;
    public string? RequestId { get; set; }
    public ErrorDetails? Details { get; set; }
    public List<ValidationError>? ValidationErrors { get; set; }
}

/// <summary>
/// Detalles adicionales del error (solo en desarrollo)
/// </summary>
public class ErrorDetails
{
    public string? ExceptionType { get; set; }
    public string? StackTrace { get; set; }
    public string? InnerException { get; set; }
}

/// <summary>
/// Error de validación de campo
/// </summary>
public class ValidationError
{
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public object? AttemptedValue { get; set; }
}

