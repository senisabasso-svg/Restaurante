using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using CornerApp.API.Data;
using System.Data;

namespace CornerApp.API.Services;

/// <summary>
/// Servicio para realizar backups automáticos de SQL Server
/// </summary>
public class DatabaseBackupService : IDatabaseBackupService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DatabaseBackupService> _logger;
    private readonly string _backupDirectory;
    private readonly string _connectionString;

    public DatabaseBackupService(
        ApplicationDbContext context,
        IConfiguration configuration,
        ILogger<DatabaseBackupService> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
        
        // Obtener connection string
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

        // Configurar directorio de backups
        var backupPath = configuration["Backup:Directory"] ?? "backups";
        _backupDirectory = Path.IsPathRooted(backupPath)
            ? backupPath
            : Path.Combine(Directory.GetCurrentDirectory(), backupPath);

        // Crear directorio si no existe
        if (!Directory.Exists(_backupDirectory))
        {
            Directory.CreateDirectory(_backupDirectory);
            _logger.LogInformation("Directorio de backups creado: {BackupDirectory}", _backupDirectory);
        }
    }

    public async Task<BackupResult> CreateBackupAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var databaseName = ExtractDatabaseName(_connectionString);
            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
            var backupFileName = $"{databaseName}_backup_{timestamp}.bak";
            var backupFilePath = Path.Combine(_backupDirectory, backupFileName);

            _logger.LogInformation("Iniciando backup de base de datos: {DatabaseName}", databaseName);

            using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            // Escapar la ruta del archivo para SQL
            var escapedBackupPath = backupFilePath.Replace("'", "''");
            
            var backupCommand = $@"
                BACKUP DATABASE [{databaseName}]
                TO DISK = '{escapedBackupPath}'
                WITH FORMAT, INIT, NAME = 'CornerApp Full Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10";

            using var command = new SqlCommand(backupCommand, connection);
            command.CommandTimeout = 300; // 5 minutos timeout

            await command.ExecuteNonQueryAsync(cancellationToken);

            // Verificar que el archivo se creó
            if (!File.Exists(backupFilePath))
            {
                throw new InvalidOperationException($"El archivo de backup no se creó: {backupFilePath}");
            }

            var fileInfo = new FileInfo(backupFilePath);
            var result = new BackupResult
            {
                Success = true,
                BackupFilePath = backupFilePath,
                FileSizeBytes = fileInfo.Length,
                CreatedAt = DateTime.UtcNow
            };

            _logger.LogInformation(
                "Backup completado exitosamente: {BackupFilePath} ({FileSize} bytes)",
                backupFilePath,
                fileInfo.Length);

            // Limpiar backups antiguos si está configurado
            await CleanupOldBackupsAsync(cancellationToken);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear backup de base de datos");
            return new BackupResult
            {
                Success = false,
                ErrorMessage = ex.Message,
                CreatedAt = DateTime.UtcNow
            };
        }
    }

    public async Task<List<BackupInfo>> GetBackupHistoryAsync()
    {
        try
        {
            if (!Directory.Exists(_backupDirectory))
            {
                return new List<BackupInfo>();
            }

            var backupFiles = Directory.GetFiles(_backupDirectory, "*.bak")
                .Select(filePath =>
                {
                    var fileInfo = new FileInfo(filePath);
                    return new BackupInfo
                    {
                        FilePath = filePath,
                        FileSizeBytes = fileInfo.Length,
                        CreatedAt = fileInfo.CreationTimeUtc
                    };
                })
                .OrderByDescending(b => b.CreatedAt)
                .ToList();

            return await Task.FromResult(backupFiles);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener historial de backups");
            return new List<BackupInfo>();
        }
    }

    public async Task<bool> RestoreBackupAsync(string backupFilePath, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!File.Exists(backupFilePath))
            {
                _logger.LogError("Archivo de backup no encontrado: {BackupFilePath}", backupFilePath);
                return false;
            }

            var databaseName = ExtractDatabaseName(_connectionString);
            
            _logger.LogWarning("Iniciando restauración de backup: {BackupFilePath} a base de datos: {DatabaseName}", 
                backupFilePath, databaseName);

            using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            // Cerrar todas las conexiones a la base de datos
            var closeConnectionsCommand = $@"
                ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE";

            using (var command = new SqlCommand(closeConnectionsCommand, connection))
            {
                command.CommandTimeout = 60;
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            // Escapar la ruta del archivo para SQL
            var escapedBackupPath = backupFilePath.Replace("'", "''");
            
            // Restaurar backup
            var restoreCommand = $@"
                RESTORE DATABASE [{databaseName}]
                FROM DISK = '{escapedBackupPath}'
                WITH REPLACE, RECOVERY";

            using var restoreCmd = new SqlCommand(restoreCommand, connection);
            restoreCmd.CommandTimeout = 600; // 10 minutos timeout

            await restoreCmd.ExecuteNonQueryAsync(cancellationToken);

            // Volver a modo multi-usuario
            var multiUserCommand = $@"ALTER DATABASE [{databaseName}] SET MULTI_USER";
            using (var command = new SqlCommand(multiUserCommand, connection))
            {
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            _logger.LogInformation("Backup restaurado exitosamente: {BackupFilePath}", backupFilePath);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al restaurar backup: {BackupFilePath}", backupFilePath);
            return false;
        }
    }

    private string ExtractDatabaseName(string connectionString)
    {
        var builder = new SqlConnectionStringBuilder(connectionString);
        return builder.InitialCatalog ?? "CornerAppDb";
    }

    private async Task CleanupOldBackupsAsync(CancellationToken cancellationToken)
    {
        try
        {
            var maxBackups = _configuration.GetValue<int>("Backup:MaxBackups", 10);
            var retentionDays = _configuration.GetValue<int>("Backup:RetentionDays", 30);

            if (!Directory.Exists(_backupDirectory))
            {
                return;
            }

            var backupFiles = Directory.GetFiles(_backupDirectory, "*.bak")
                .Select(f => new FileInfo(f))
                .OrderByDescending(f => f.CreationTimeUtc)
                .ToList();

            // Eliminar backups más antiguos que el límite de cantidad
            if (backupFiles.Count > maxBackups)
            {
                var filesToDelete = backupFiles.Skip(maxBackups).ToList();
                foreach (var file in filesToDelete)
                {
                    try
                    {
                        File.Delete(file.FullName);
                        _logger.LogInformation("Backup antiguo eliminado: {FilePath}", file.FullName);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "No se pudo eliminar backup antiguo: {FilePath}", file.FullName);
                    }
                }
            }

            // Eliminar backups más antiguos que el período de retención
            var cutoffDate = DateTime.UtcNow.AddDays(-retentionDays);
            var oldFiles = backupFiles
                .Where(f => f.CreationTimeUtc < cutoffDate)
                .ToList();

            foreach (var file in oldFiles)
            {
                try
                {
                    File.Delete(file.FullName);
                    _logger.LogInformation("Backup expirado eliminado: {FilePath} (creado: {CreatedAt})", 
                        file.FullName, file.CreationTimeUtc);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "No se pudo eliminar backup expirado: {FilePath}", file.FullName);
                }
            }

            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al limpiar backups antiguos");
        }
    }
}
