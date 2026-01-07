# Secrets Management - Gestión de Secretos

## Descripción

Este documento describe el sistema de gestión de secretos implementado en CornerApp API para manejar credenciales y configuraciones sensibles de forma segura.

## ¿Por qué Secrets Management?

En producción, es crítico:
- **Nunca** commitear secretos en código
- **Nunca** almacenar secretos en archivos de configuración versionados
- **Rotar** secretos periódicamente
- **Auditar** acceso a secretos
- **Centralizar** gestión de secretos

## Proveedores Soportados

El sistema soporta múltiples proveedores con fallback automático:

### 1. Azure Key Vault (Recomendado para Azure)

**Ventajas**:
- Integración nativa con Azure
- Rotación automática de secretos
- Auditoría completa
- Control de acceso granular

**Configuración**:
```json
{
  "Secrets": {
    "Provider": "AzureKeyVault",
    "AzureKeyVault": {
      "VaultUri": "https://tu-vault.vault.azure.net/",
      "Enabled": true
    }
  }
}
```

**Variables de Entorno**:
```bash
AZURE_CLIENT_ID=tu-client-id
AZURE_CLIENT_SECRET=tu-client-secret
AZURE_TENANT_ID=tu-tenant-id
```

### 2. AWS Secrets Manager (Recomendado para AWS)

**Ventajas**:
- Integración nativa con AWS
- Rotación automática
- Encriptación en reposo
- Integración con IAM

**Configuración**:
```json
{
  "Secrets": {
    "Provider": "AWSSecretsManager",
    "AWS": {
      "Region": "us-east-1",
      "Enabled": true
    }
  }
}
```

**Variables de Entorno**:
```bash
AWS_ACCESS_KEY_ID=tu-access-key
AWS_SECRET_ACCESS_KEY=tu-secret-key
AWS_REGION=us-east-1
```

### 3. Environment Variables (Desarrollo/Testing)

**Ventajas**:
- Simple y rápido
- No requiere servicios externos
- Ideal para desarrollo local

**Configuración**:
```bash
# Con prefijo SECRET_
export SECRET_JWT_SECRET_KEY="tu-clave-secreta"
export SECRET_CONNECTION_STRINGS__DEFAULT_CONNECTION="Server=..."

# Sin prefijo
export JWT_SECRET_KEY="tu-clave-secreta"
export CONNECTION_STRINGS__DEFAULT_CONNECTION="Server=..."
```

### 4. Configuration (Fallback)

Si ningún proveedor está configurado, usa `appsettings.json` como fallback (solo desarrollo).

## Uso en Código

### Inyectar ISecretsService

```csharp
public class MyService
{
    private readonly ISecretsService _secretsService;
    
    public MyService(ISecretsService secretsService)
    {
        _secretsService = secretsService;
    }
    
    public async Task<string> GetApiKeyAsync()
    {
        return await _secretsService.GetSecretAsync("API_KEY", "default-value");
    }
}
```

### Obtener un Secreto

```csharp
// Con valor por defecto
var secret = await _secretsService.GetSecretAsync("MY_SECRET", "default-value");

// Sin valor por defecto (puede retornar null)
var secret = await _secretsService.GetSecretAsync("MY_SECRET");

// Verificar si existe
var exists = await _secretsService.SecretExistsAsync("MY_SECRET");
```

### Obtener Múltiples Secretos

```csharp
var keys = new[] { "SECRET_1", "SECRET_2", "SECRET_3" };
var secrets = await _secretsService.GetSecretsAsync(keys);

foreach (var (key, value) in secrets)
{
    Console.WriteLine($"{key}: {value}");
}
```

## Configuración

### appsettings.json

```json
{
  "Secrets": {
    "Provider": "Configuration",
    "AzureKeyVault": {
      "VaultUri": "",
      "Enabled": false
    },
    "AWS": {
      "Region": "",
      "Enabled": false
    },
    "CacheEnabled": true,
    "CacheExpirationMinutes": 60
  }
}
```

### Variables de Entorno

```bash
# Para Azure Key Vault
Secrets__AzureKeyVault__VaultUri=https://tu-vault.vault.azure.net/
Secrets__AzureKeyVault__Enabled=true

# Para AWS Secrets Manager
Secrets__AWS__Region=us-east-1
Secrets__AWS__Enabled=true
```

## Secretos Comunes

### JWT Secret Key

```bash
# Variable de entorno
JWT_SECRET_KEY=tu-clave-de-al-menos-32-caracteres

# O desde secrets service
SECRET_JWT_SECRET_KEY=tu-clave-de-al-menos-32-caracteres
```

### Connection String

```bash
# Variable de entorno
CONNECTION_STRINGS__DEFAULT_CONNECTION=Server=...;Database=...;...

# O desde secrets service
SECRET_CONNECTION_STRINGS__DEFAULT_CONNECTION=Server=...;Database=...;...
```

### Redis Connection

```bash
# Variable de entorno
CONNECTION_STRINGS__REDIS=localhost:6379

# O desde secrets service
SECRET_CONNECTION_STRINGS__REDIS=localhost:6379
```

## Cache de Secretos

El servicio cachea secretos en memoria para mejorar performance:

- **Habilitado por defecto**: `CacheEnabled: true`
- **Expiración**: 60 minutos por defecto
- **Limpieza manual**: `secretsService.ClearCache()`

**Nota**: El cache se limpia automáticamente cuando se reinicia la aplicación.

## Implementación de Proveedores

### Azure Key Vault

Para implementar completamente Azure Key Vault:

1. **Instalar paquete NuGet**:
```bash
dotnet add package Azure.Security.KeyVault.Secrets
dotnet add package Azure.Identity
```

2. **Actualizar SecretsService.cs**:
```csharp
private string? RetrieveFromAzureKeyVault(string key)
{
    var vaultUri = _configuration["Secrets:AzureKeyVault:VaultUri"];
    var credential = new DefaultAzureCredential();
    var client = new SecretClient(new Uri(vaultUri!), credential);
    
    try
    {
        var secret = client.GetSecret(key);
        return secret.Value.Value;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error al obtener secreto {Key} desde Azure Key Vault", key);
        return null;
    }
}
```

### AWS Secrets Manager

Para implementar completamente AWS Secrets Manager:

1. **Instalar paquete NuGet**:
```bash
dotnet add package AWSSDK.SecretsManager
```

2. **Actualizar SecretsService.cs**:
```csharp
private string? RetrieveFromAWSSecretsManager(string key)
{
    var region = _configuration["Secrets:AWS:Region"];
    var client = new AmazonSecretsManagerClient(RegionEndpoint.GetBySystemName(region));
    
    try
    {
        var request = new GetSecretValueRequest { SecretId = key };
        var response = client.GetSecretValueAsync(request).GetAwaiter().GetResult();
        return response.SecretString;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error al obtener secreto {Key} desde AWS Secrets Manager", key);
        return null;
    }
}
```

## Mejores Prácticas

### 1. Nunca Commitear Secretos

```bash
# .gitignore
*.env
appsettings.Production.json
secrets.json
```

### 2. Usar Variables de Entorno en Producción

```bash
# ✅ Correcto
export JWT_SECRET_KEY="tu-clave-secreta"

# ❌ Incorrecto
# En appsettings.json: "Jwt:Key": "tu-clave-secreta"
```

### 3. Rotar Secretos Regularmente

- JWT Secret Key: Cada 90 días
- Database Passwords: Cada 180 días
- API Keys: Según política de seguridad

### 4. Usar Secretos Diferentes por Ambiente

```bash
# Desarrollo
JWT_SECRET_KEY=dev-key-here

# Staging
JWT_SECRET_KEY=staging-key-here

# Producción
JWT_SECRET_KEY=production-key-here
```

### 5. Validar Secretos al Iniciar

```csharp
// En Program.cs
var jwtKey = await secretsService.GetSecretAsync("JWT_SECRET_KEY");
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    throw new InvalidOperationException("JWT Secret Key inválido");
}
```

## Troubleshooting

### Secreto no encontrado

1. **Verificar proveedor configurado**:
```bash
# Ver logs al iniciar
[INFO] SecretsService inicializado con proveedor: Configuration
```

2. **Verificar variable de entorno**:
```bash
# Windows
echo %JWT_SECRET_KEY%

# Linux/Mac
echo $JWT_SECRET_KEY
```

3. **Verificar configuración**:
```json
{
  "Secrets": {
    "Provider": "EnvironmentVariables"
  }
}
```

### Cache no se actualiza

```csharp
// Limpiar cache manualmente
secretsService.ClearCache();
```

### Azure Key Vault no funciona

1. **Verificar credenciales**:
```bash
az login
az account show
```

2. **Verificar permisos**:
```bash
az keyvault show --name tu-vault --query properties.enableRbacAuthorization
```

3. **Verificar acceso**:
```bash
az keyvault secret show --vault-name tu-vault --name JWT_SECRET_KEY
```

## Seguridad

### ✅ Hacer

- Usar Azure Key Vault o AWS Secrets Manager en producción
- Rotar secretos regularmente
- Usar Managed Identities cuando sea posible
- Auditar acceso a secretos
- Limitar permisos al mínimo necesario

### ❌ No hacer

- Commitear secretos en código
- Compartir secretos por email/chat
- Usar secretos de desarrollo en producción
- Hardcodear secretos
- Loggear valores de secretos

## Referencias

- [Azure Key Vault Documentation](https://docs.microsoft.com/azure/key-vault/)
- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [.NET Configuration](https://docs.microsoft.com/aspnet/core/fundamentals/configuration/)
