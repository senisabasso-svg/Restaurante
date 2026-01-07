namespace CornerApp.API.DTOs;

/// <summary>
/// Parámetros de paginación para requests
/// </summary>
public class PaginationParams
{
    private int _page = 1;
    private int _pageSize = 20;
    private const int MaxPageSize = 100;

    /// <summary>
    /// Número de página (empezando en 1)
    /// </summary>
    public int Page
    {
        get => _page;
        set => _page = value < 1 ? 1 : value;
    }

    /// <summary>
    /// Cantidad de items por página (máximo 100)
    /// </summary>
    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value < 1 ? 20 : (value > MaxPageSize ? MaxPageSize : value);
    }
}

/// <summary>
/// Respuesta paginada genérica
/// </summary>
public class PagedResponse<T>
{
    public List<T> Data { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasPreviousPage => Page > 1;
    public bool HasNextPage => Page < TotalPages;
}
