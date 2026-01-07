namespace CornerApp.API.Services;

/// <summary>
/// Servicio para realizar backups automáticos de la base de datos
/// </summary>
public interface IDatabaseBackupService
{
    /// <summary>
    /// Ejecuta un backup de la base de datos
    /// </summary>
    Task<BackupResult> CreateBackupAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtiene información sobre los backups disponibles
    /// </summary>
    Task<List<BackupInfo>> GetBackupHistoryAsync();

    /// <summary>
    /// Restaura un backup desde un archivo
    /// </summary>
    Task<bool> RestoreBackupAsync(string backupFilePath, CancellationToken cancellationToken = default);
}

/// <summary>
/// Resultado de una operación de backup
/// </summary>
public class BackupResult
{
    public bool Success { get; set; }
    public string? BackupFilePath { get; set; }
    public long FileSizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// Información sobre un backup
/// </summary>
public class BackupInfo
{
    public string FilePath { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
}
