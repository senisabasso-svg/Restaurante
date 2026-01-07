using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;

namespace CornerApp.API.Helpers;

/// <summary>
/// Helper para validar archivos subidos
/// </summary>
public static class FileValidationHelper
{
    // Extensiones permitidas para imágenes
    private static readonly string[] AllowedImageExtensions = { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp" };
    
    // Extensiones permitidas para íconos (más restrictivo)
    private static readonly string[] AllowedIconExtensions = { ".jpg", ".jpeg", ".png", ".svg", ".webp" };
    
    // Tipos MIME permitidos para imágenes
    private static readonly string[] AllowedImageMimeTypes = 
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/bmp",
        "image/svg+xml"
    };

    /// <summary>
    /// Valida un archivo de imagen
    /// </summary>
    public static (bool IsValid, string ErrorMessage) ValidateImageFile(
        IFormFile? file, 
        long maxSizeBytes, 
        int? maxWidth = null, 
        int? maxHeight = null,
        bool allowIcons = false)
    {
        if (file == null)
        {
            return (false, "No se proporcionó ningún archivo");
        }

        if (file.Length == 0)
        {
            return (false, "El archivo está vacío");
        }

        // Validar tamaño
        if (file.Length > maxSizeBytes)
        {
            var maxSizeMB = maxSizeBytes / (1024.0 * 1024.0);
            return (false, $"El archivo excede el tamaño máximo permitido de {maxSizeMB:F2} MB");
        }

        // Validar extensión
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowedExtensions = allowIcons ? AllowedIconExtensions : AllowedImageExtensions;
        
        if (string.IsNullOrEmpty(extension) || !allowedExtensions.Contains(extension))
        {
            return (false, $"Extensión de archivo no permitida. Extensiones permitidas: {string.Join(", ", allowedExtensions)}");
        }

        // Validar tipo MIME
        if (!string.IsNullOrEmpty(file.ContentType) && !AllowedImageMimeTypes.Contains(file.ContentType.ToLowerInvariant()))
        {
            return (false, $"Tipo de archivo no permitido. Tipos permitidos: {string.Join(", ", AllowedImageMimeTypes)}");
        }

        // Validar nombre de archivo (evitar caracteres peligrosos)
        if (!IsValidFileName(file.FileName))
        {
            return (false, "El nombre del archivo contiene caracteres no permitidos");
        }

        // Validar dimensiones si se especifican
        if (maxWidth.HasValue || maxHeight.HasValue)
        {
            // Nota: La validación de dimensiones reales requiere procesar la imagen
            // Esto se puede hacer después de subir el archivo o usando una librería de imágenes
            // Por ahora, solo validamos que el archivo sea una imagen válida
        }

        return (true, string.Empty);
    }

    /// <summary>
    /// Valida un archivo de comprobante (imagen en base64)
    /// </summary>
    public static (bool IsValid, string ErrorMessage) ValidateReceiptImage(string? base64Image, long maxSizeBytes)
    {
        if (string.IsNullOrWhiteSpace(base64Image))
        {
            return (false, "No se proporcionó ninguna imagen");
        }

        // Validar formato base64
        if (!IsValidBase64Image(base64Image))
        {
            return (false, "El formato de la imagen no es válido. Debe ser una imagen en formato base64");
        }

        // Calcular tamaño aproximado (base64 es ~33% más grande que el binario)
        var base64Length = base64Image.Length;
        var estimatedSize = (base64Length * 3) / 4;

        if (estimatedSize > maxSizeBytes)
        {
            var maxSizeMB = maxSizeBytes / (1024.0 * 1024.0);
            return (false, $"La imagen excede el tamaño máximo permitido de {maxSizeMB:F2} MB");
        }

        return (true, string.Empty);
    }

    /// <summary>
    /// Valida que un nombre de archivo sea seguro
    /// </summary>
    public static bool IsValidFileName(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return false;
        }

        // Caracteres peligrosos
        var invalidChars = Path.GetInvalidFileNameChars();
        if (fileName.IndexOfAny(invalidChars) >= 0)
        {
            return false;
        }

        // Evitar nombres reservados de Windows
        var reservedNames = new[] { "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9" };
        var fileNameWithoutExtension = Path.GetFileNameWithoutExtension(fileName).ToUpperInvariant();
        if (reservedNames.Contains(fileNameWithoutExtension))
        {
            return false;
        }

        // Validar longitud
        if (fileName.Length > 255)
        {
            return false;
        }

        return true;
    }

    /// <summary>
    /// Valida que una cadena sea una imagen base64 válida
    /// </summary>
    public static bool IsValidBase64Image(string base64String)
    {
        if (string.IsNullOrWhiteSpace(base64String))
        {
            return false;
        }

        // Debe comenzar con data:image/ o ser base64 puro
        if (base64String.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
        {
            // Formato: data:image/png;base64,{base64data}
            var parts = base64String.Split(',');
            if (parts.Length != 2)
            {
                return false;
            }

            var mimeType = parts[0].Split(';')[0].Replace("data:", "");
            if (!AllowedImageMimeTypes.Contains(mimeType.ToLowerInvariant()))
            {
                return false;
            }

            base64String = parts[1];
        }

        // Validar que sea base64 válido
        try
        {
            var buffer = Convert.FromBase64String(base64String);
            
            // Validar que tenga un tamaño mínimo (al menos 100 bytes para ser una imagen válida)
            if (buffer.Length < 100)
            {
                return false;
            }

            // Validar magic numbers de imágenes comunes
            return IsValidImageMagicNumber(buffer);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Valida los magic numbers de una imagen para asegurar que es realmente una imagen
    /// </summary>
    private static bool IsValidImageMagicNumber(byte[] buffer)
    {
        if (buffer.Length < 4)
        {
            return false;
        }

        // JPEG: FF D8 FF
        if (buffer[0] == 0xFF && buffer[1] == 0xD8 && buffer[2] == 0xFF)
        {
            return true;
        }

        // PNG: 89 50 4E 47
        if (buffer[0] == 0x89 && buffer[1] == 0x50 && buffer[2] == 0x4E && buffer[3] == 0x47)
        {
            return true;
        }

        // GIF: 47 49 46 38
        if (buffer[0] == 0x47 && buffer[1] == 0x49 && buffer[2] == 0x46 && buffer[3] == 0x38)
        {
            return true;
        }

        // BMP: 42 4D
        if (buffer[0] == 0x42 && buffer[1] == 0x4D)
        {
            return true;
        }

        // WEBP: RIFF...WEBP (más complejo, verificar los primeros bytes)
        if (buffer.Length >= 12 &&
            buffer[0] == 0x52 && buffer[1] == 0x49 && buffer[2] == 0x46 && buffer[3] == 0x46 &&
            buffer[8] == 0x57 && buffer[9] == 0x45 && buffer[10] == 0x42 && buffer[11] == 0x50)
        {
            return true;
        }

        return false;
    }

    /// <summary>
    /// Genera un nombre de archivo seguro basado en un nombre original
    /// </summary>
    public static string GenerateSafeFileName(string originalFileName)
    {
        if (string.IsNullOrWhiteSpace(originalFileName))
        {
            return $"file_{DateTime.UtcNow:yyyyMMddHHmmss}";
        }

        var extension = Path.GetExtension(originalFileName);
        var nameWithoutExtension = Path.GetFileNameWithoutExtension(originalFileName);
        
        // Remover caracteres peligrosos
        var invalidChars = Path.GetInvalidFileNameChars();
        foreach (var c in invalidChars)
        {
            nameWithoutExtension = nameWithoutExtension.Replace(c, '_');
        }

        // Limitar longitud
        if (nameWithoutExtension.Length > 100)
        {
            nameWithoutExtension = nameWithoutExtension[..100];
        }

        // Agregar timestamp para evitar colisiones
        var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
        return $"{nameWithoutExtension}_{timestamp}{extension}";
    }

    /// <summary>
    /// Obtiene el tamaño de una imagen base64 en bytes
    /// </summary>
    public static long GetBase64ImageSize(string base64String)
    {
        if (string.IsNullOrWhiteSpace(base64String))
        {
            return 0;
        }

        // Remover prefijo data:image/ si existe
        if (base64String.Contains(','))
        {
            base64String = base64String.Split(',')[1];
        }

        try
        {
            var buffer = Convert.FromBase64String(base64String);
            return buffer.Length;
        }
        catch
        {
            return 0;
        }
    }
}
