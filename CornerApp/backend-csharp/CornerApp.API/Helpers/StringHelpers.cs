namespace CornerApp.API.Helpers;

/// <summary>
/// Helpers para operaciones con strings
/// </summary>
public static class StringHelpers
{
    /// <summary>
    /// Compara dos strings ignorando mayúsculas/minúsculas de forma segura
    /// </summary>
    public static bool EqualsIgnoreCase(string? str1, string? str2)
    {
        if (str1 == null && str2 == null) return true;
        if (str1 == null || str2 == null) return false;
        return str1.Equals(str2, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Verifica si un string contiene otro ignorando mayúsculas/minúsculas de forma segura
    /// </summary>
    public static bool ContainsIgnoreCase(string? source, string? value)
    {
        if (string.IsNullOrEmpty(source) || string.IsNullOrEmpty(value)) return false;
        return source.Contains(value, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Normaliza un string para búsquedas (trim y lowercase)
    /// </summary>
    public static string? NormalizeForSearch(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        return input.Trim().ToLowerInvariant();
    }
}
