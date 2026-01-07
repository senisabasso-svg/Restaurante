using CornerApp.API.DTOs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CornerApp.API.Helpers;

/// <summary>
/// Helper para crear respuestas estandarizadas de la API
/// </summary>
public static class ApiResponseHelper
{
    /// <summary>
    /// Crea una respuesta exitosa con datos
    /// </summary>
    public static ApiResponse<T> Success<T>(T data, string message = "Operación exitosa", HttpContext? context = null)
    {
        return new ApiResponse<T>
        {
            Success = true,
            Message = message,
            Data = data,
            RequestId = context?.Items["RequestId"]?.ToString(),
            Timestamp = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Crea una respuesta exitosa sin datos
    /// </summary>
    public static ApiResponse Success(string message = "Operación exitosa", HttpContext? context = null)
    {
        return new ApiResponse
        {
            Success = true,
            Message = message,
            RequestId = context?.Items["RequestId"]?.ToString(),
            Timestamp = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Crea una respuesta de error
    /// </summary>
    public static ApiResponse Error(string message, HttpContext? context = null)
    {
        return new ApiResponse
        {
            Success = false,
            Message = message,
            RequestId = context?.Items["RequestId"]?.ToString(),
            Timestamp = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Crea una respuesta paginada exitosa
    /// </summary>
    public static PagedApiResponse<T> PagedSuccess<T>(PagedResponse<T> data, string message = "Datos obtenidos exitosamente", HttpContext? context = null)
    {
        return new PagedApiResponse<T>
        {
            Success = true,
            Message = message,
            Data = data,
            RequestId = context?.Items["RequestId"]?.ToString(),
            Timestamp = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Crea un ActionResult exitoso con datos
    /// </summary>
    public static ActionResult<T> OkResult<T>(T data, string message = "Operación exitosa", HttpContext? context = null)
    {
        return new OkObjectResult(Success(data, message, context));
    }

    /// <summary>
    /// Crea un ActionResult exitoso sin datos
    /// </summary>
    public static ActionResult OkResult(string message = "Operación exitosa", HttpContext? context = null)
    {
        return new OkObjectResult(Success(message, context));
    }

    /// <summary>
    /// Crea un ActionResult de error
    /// </summary>
    public static ActionResult ErrorResult(string message, HttpContext? context = null, int statusCode = 400)
    {
        var response = Error(message, context);
        return statusCode switch
        {
            400 => new BadRequestObjectResult(response),
            404 => new NotFoundObjectResult(response),
            401 => new UnauthorizedObjectResult(response),
            403 => new ObjectResult(response) { StatusCode = 403 },
            500 => new ObjectResult(response) { StatusCode = 500 },
            _ => new ObjectResult(response) { StatusCode = statusCode }
        };
    }

    /// <summary>
    /// Crea un ActionResult paginado exitoso
    /// </summary>
    public static ActionResult PagedOkResult<T>(PagedResponse<T> data, string message = "Datos obtenidos exitosamente", HttpContext? context = null)
    {
        return new OkObjectResult(PagedSuccess(data, message, context));
    }
}
