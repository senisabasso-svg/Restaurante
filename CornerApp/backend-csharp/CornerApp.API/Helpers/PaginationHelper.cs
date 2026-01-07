using Microsoft.EntityFrameworkCore;
using CornerApp.API.DTOs;

namespace CornerApp.API.Helpers;

/// <summary>
/// Helper para operaciones de paginación
/// </summary>
public static class PaginationHelper
{
    /// <summary>
    /// Aplica paginación a una query y devuelve respuesta paginada
    /// </summary>
    public static async Task<PagedResponse<T>> ToPagedResponseAsync<T>(
        IQueryable<T> query,
        int page,
        int pageSize)
    {
        var totalCount = await query.CountAsync();
        
        var data = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResponse<T>
        {
            Data = data,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    /// <summary>
    /// Valida y normaliza parámetros de paginación
    /// </summary>
    public static (int page, int pageSize) NormalizePagination(int? page, int? pageSize, int defaultPageSize = 20, int maxPageSize = 100)
    {
        var normalizedPage = page.HasValue && page.Value > 0 ? page.Value : 1;
        var normalizedPageSize = pageSize.HasValue && pageSize.Value > 0 
            ? Math.Min(pageSize.Value, maxPageSize) 
            : defaultPageSize;

        return (normalizedPage, normalizedPageSize);
    }
}
