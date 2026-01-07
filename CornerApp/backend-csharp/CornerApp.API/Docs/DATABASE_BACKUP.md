# Database Backup - Sistema de Backup Automático

## Descripción

Este documento describe el sistema de backup automático de base de datos implementado en CornerApp API para SQL Server.

## ¿Por qué Backup Automático?

En producción es crítico:
- **Protección de datos**: Recuperar datos en caso de pérdida
- **Cumplimiento**: Requisitos legales y regulatorios
- **Disaster Recovery**: Recuperación ante desastres
- **Historial**: Mantener versiones anteriores de los datos

## Características

### 1. Backups Automáticos

- **Programados**: Backups automáticos según intervalo configurado
- **Background Service**: Se ejecuta en segundo plano sin afectar la API
- **Limpieza automática**: Elimina backups antiguos según políticas

### 2. Backups Manuales

- **API Endpoint**: Crear backups bajo demanda
- **Historial**: Ver todos los backups disponibles
- **Restauración**: Restaurar desde un backup específico

### 3. Gestión de Backups

- **Retención**: Configurar cuántos backups mantener
- **Expiración**: Eliminar backups más antiguos que X días
- **Tamaño**: Monitorear tamaño de backups

## Configuración

### appsettings.json

```json
{
  "Backup": {
    "Enabled": true,
    "Directory": "backups",
    "IntervalHours": 24,
    "MaxBackups": 10,
    "RetentionDays": 30
  }
}
```

### Variables de Entorno

```bash
Backup__Enabled=true
Backup__Directory=/var/backups/cornerapp
Backup__IntervalHours=24
Backup__MaxBackups=10
Backup__RetentionDays=30
```

## Uso

### Backups Automáticos

Los backups automáticos se ejecutan según el intervalo configurado:

1. **Primer backup**: 5 minutos después de iniciar la aplicación
2. **Backups subsecuentes**: Cada `IntervalHours` horas
3. **Limpieza**: Después de cada backup, elimina backups antiguos

### Backup Manual

```bash
# Crear backup manual
POST /api/admin/backup
Authorization: Bearer {token}

# Respuesta
{
  "success": true,
  "backupFilePath": "backups/CornerAppDb_backup_20240115_143022.bak",
  "fileSizeBytes": 52428800,
  "createdAt": "2024-01-15T14:30:22Z"
}
```

### Ver Historial de Backups

```bash
# Obtener historial
GET /api/admin/backup/history
Authorization: Bearer {token}

# Respuesta
[
  {
    "filePath": "backups/CornerAppDb_backup_20240115_143022.bak",
    "fileSizeBytes": 52428800,
    "createdAt": "2024-01-15T14:30:22Z"
  },
  {
    "filePath": "backups/CornerAppDb_backup_20240114_143022.bak",
    "fileSizeBytes": 52345678,
    "createdAt": "2024-01-14T14:30:22Z"
  }
]
```

### Restaurar Backup

```bash
# Restaurar desde backup
POST /api/admin/backup/restore
Authorization: Bearer {token}
Content-Type: application/json

{
  "backupFilePath": "backups/CornerAppDb_backup_20240115_143022.bak"
}

# Respuesta
{
  "message": "Backup restaurado exitosamente",
  "backupFilePath": "backups/CornerAppDb_backup_20240115_143022.bak"
}
```

## Estructura de Archivos

```
CornerApp/
└── backups/
    ├── CornerAppDb_backup_20240115_143022.bak
    ├── CornerAppDb_backup_20240114_143022.bak
    └── CornerAppDb_backup_20240113_143022.bak
```

## Políticas de Retención

### Por Cantidad (MaxBackups)

Mantiene los últimos N backups:

```json
{
  "Backup": {
    "MaxBackups": 10
  }
}
```

Si hay 15 backups, elimina los 5 más antiguos.

### Por Tiempo (RetentionDays)

Elimina backups más antiguos que X días:

```json
{
  "Backup": {
    "RetentionDays": 30
  }
}
```

Elimina backups creados hace más de 30 días.

## Seguridad

### Permisos

- **Backups manuales**: Requieren autenticación (`[Authorize]`)
- **Backups automáticos**: Se ejecutan con permisos de la aplicación
- **Restauración**: Requiere autenticación (operación crítica)

### Almacenamiento

- **Local**: Backups se guardan en el servidor
- **Recomendado**: Copiar backups a almacenamiento externo (S3, Azure Blob, etc.)
- **Encriptación**: Considerar encriptar backups sensibles

## Mejores Prácticas

### 1. Frecuencia de Backups

- **Desarrollo**: Cada 24 horas (o deshabilitado)
- **Staging**: Cada 12 horas
- **Producción**: Cada 6 horas o más frecuente

### 2. Retención

- **Backups diarios**: Mantener 7-14 días
- **Backups semanales**: Mantener 4-8 semanas
- **Backups mensuales**: Mantener 6-12 meses

### 3. Almacenamiento Externo

```bash
# Ejemplo: Copiar a S3 después de crear backup
aws s3 cp backups/CornerAppDb_backup_*.bak s3://cornerapp-backups/
```

### 4. Verificación

- **Probar restauraciones**: Verificar que los backups se pueden restaurar
- **Monitorear tamaño**: Alertar si el tamaño crece inesperadamente
- **Verificar integridad**: Validar que los backups no estén corruptos

## Troubleshooting

### Backup Falla

1. **Verificar permisos**:
```bash
# El usuario de SQL Server debe tener permisos BACKUP DATABASE
```

2. **Verificar espacio en disco**:
```bash
# Asegurar que hay suficiente espacio para el backup
```

3. **Verificar logs**:
```
[ERROR] Error al crear backup de base de datos
```

### Backup No Se Crea

1. **Verificar que está habilitado**:
```json
{
  "Backup": {
    "Enabled": true
  }
}
```

2. **Verificar directorio**:
```bash
# El directorio debe existir y ser accesible
ls -la backups/
```

3. **Verificar connection string**:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=..."
  }
}
```

### Restauración Falla

1. **Verificar que el archivo existe**:
```bash
ls -la backups/CornerAppDb_backup_*.bak
```

2. **Verificar permisos de restauración**:
```bash
# El usuario debe tener permisos RESTORE DATABASE
```

3. **Cerrar conexiones activas**:
```sql
-- El servicio cierra conexiones automáticamente
-- Pero puede haber conexiones persistentes
```

## Integración con CI/CD

### Backup Antes de Deployment

```yaml
# .github/workflows/deploy.yml
- name: Create backup before deployment
  run: |
    curl -X POST https://api.cornerapp.com/api/admin/backup \
      -H "Authorization: Bearer ${{ secrets.ADMIN_TOKEN }}"
```

### Backup Programado

```yaml
# .github/workflows/backup.yml
on:
  schedule:
    - cron: '0 2 * * *'  # Diario a las 2 AM

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger backup
        run: |
          curl -X POST ${{ secrets.API_URL }}/api/admin/backup \
            -H "Authorization: Bearer ${{ secrets.ADMIN_TOKEN }}"
```

## Referencias

- [SQL Server BACKUP DATABASE](https://docs.microsoft.com/sql/t-sql/statements/backup-database-transact-sql)
- [SQL Server RESTORE DATABASE](https://docs.microsoft.com/sql/t-sql/statements/restore-statements-transact-sql)
- [Best Practices for SQL Server Backups](https://docs.microsoft.com/sql/relational-databases/backup-restore/backup-and-restore-best-practices)
