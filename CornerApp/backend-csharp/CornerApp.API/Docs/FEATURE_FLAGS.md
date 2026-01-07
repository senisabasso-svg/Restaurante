# Feature Flags

## Descripción

Este documento describe el sistema de Feature Flags implementado en CornerApp API para controlar funcionalidades sin necesidad de desplegar código nuevo.

## ¿Qué son Feature Flags?

Los Feature Flags (también conocidos como Feature Toggles) permiten habilitar o deshabilitar funcionalidades en tiempo de ejecución sin cambiar código. Esto es útil para:

- **Rollouts graduales**: Habilitar una feature para un porcentaje de usuarios
- **A/B Testing**: Probar diferentes versiones de una feature
- **Kill Switch**: Deshabilitar rápidamente una feature problemática
- **Beta Testing**: Habilitar features solo para usuarios específicos
- **Lanzamientos programados**: Habilitar features en fechas específicas

## Componentes

### 1. IFeatureFlagsService / FeatureFlagsService

Servicio principal para gestionar feature flags:

```csharp
public interface IFeatureFlagsService
{
    bool IsEnabled(string featureName);
    bool IsEnabledForUser(string featureName, int? userId);
    Dictionary<string, bool> GetAllFeatures();
    void EnableFeature(string featureName);
    void DisableFeature(string featureName);
    void ConfigureFeature(string featureName, FeatureFlagConfig config);
}
```

### 2. FeatureFlagAttribute

Atributo para proteger endpoints con feature flags:

```csharp
[FeatureFlag("NewCheckoutFlow")]
[HttpPost("checkout")]
public async Task<IActionResult> Checkout(...)
{
    // Solo se ejecuta si la feature está habilitada
}
```

### 3. FeatureFlagsController

Controller para gestionar feature flags vía API:
- `GET /api/featureflags` - Obtener todas las features
- `GET /api/featureflags/{name}` - Verificar si está habilitada
- `GET /api/featureflags/{name}/user` - Verificar para usuario actual
- `POST /api/featureflags/{name}/enable` - Habilitar
- `POST /api/featureflags/{name}/disable` - Deshabilitar

## Configuración

### appsettings.json

```json
{
  "FeatureFlags": {
    "NewCheckoutFlow": {
      "Enabled": false,
      "PercentageEnabled": 0.1,
      "AllowedUserIds": []
    },
    "AdvancedSearch": {
      "Enabled": true
    },
    "BetaFeatures": {
      "Enabled": false,
      "AllowedUserIds": [1, 2, 3]
    },
    "PromoCodeSystem": {
      "Enabled": true,
      "EnabledFrom": "2024-01-01T00:00:00Z",
      "EnabledUntil": "2024-12-31T23:59:59Z"
    }
  }
}
```

**Opciones de configuración**:
- `Enabled`: Habilitar/deshabilitar globalmente (bool)
- `AllowedUserIds`: Lista de IDs de usuarios permitidos (array de int)
- `PercentageEnabled`: Porcentaje de usuarios (0.0 a 1.0, ej: 0.1 = 10%)
- `EnabledFrom`: Fecha de inicio (ISO 8601)
- `EnabledUntil`: Fecha de fin (ISO 8601)

## Uso

### Opción 1: Verificación en Código

```csharp
public class CheckoutController : ControllerBase
{
    private readonly IFeatureFlagsService _featureFlags;

    [HttpPost]
    public async Task<IActionResult> Checkout(CheckoutRequest request)
    {
        if (_featureFlags.IsEnabled("NewCheckoutFlow"))
        {
            // Usar nuevo flujo
            return await ProcessNewCheckoutAsync(request);
        }
        else
        {
            // Usar flujo antiguo
            return await ProcessOldCheckoutAsync(request);
        }
    }
}
```

### Opción 2: Atributo en Endpoint

```csharp
[FeatureFlag("NewCheckoutFlow")]
[HttpPost("checkout")]
public async Task<IActionResult> NewCheckout(CheckoutRequest request)
{
    // Este endpoint solo está disponible si la feature está habilitada
    return await ProcessNewCheckoutAsync(request);
}
```

### Opción 3: Verificación por Usuario

```csharp
[HttpPost("beta-feature")]
public async Task<IActionResult> BetaFeature()
{
    var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    
    if (!_featureFlags.IsEnabledForUser("BetaFeatures", userId))
    {
        return NotFound(new { error = "Esta funcionalidad no está disponible para tu cuenta" });
    }

    // Procesar feature beta
    return Ok();
}
```

### Opción 4: Rollout Gradual (Percentage)

```csharp
[HttpPost("new-feature")]
public async Task<IActionResult> NewFeature()
{
    var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    
    // Habilitado para 10% de usuarios (configurado en appsettings.json)
    if (_featureFlags.IsEnabledForUser("NewFeature", userId))
    {
        return await ProcessNewFeatureAsync();
    }
    
    return await ProcessOldFeatureAsync();
}
```

## Casos de Uso

### 1. Rollout Gradual

Habilitar una feature para el 10% de usuarios:

```json
{
  "NewCheckoutFlow": {
    "Enabled": true,
    "PercentageEnabled": 0.1
  }
}
```

### 2. Beta Testing

Habilitar solo para usuarios específicos:

```json
{
  "BetaFeatures": {
    "Enabled": false,
    "AllowedUserIds": [1, 2, 3, 100, 200]
  }
}
```

### 3. Lanzamiento Programado

Habilitar desde/hasta fechas específicas:

```json
{
  "PromoCodeSystem": {
    "Enabled": true,
    "EnabledFrom": "2024-01-01T00:00:00Z",
    "EnabledUntil": "2024-12-31T23:59:59Z"
  }
}
```

### 4. Kill Switch

Deshabilitar rápidamente una feature problemática:

```json
{
  "ProblematicFeature": {
    "Enabled": false
  }
}
```

## API Endpoints

### Obtener Todas las Features

```bash
GET /api/featureflags
Authorization: Bearer {token}
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "NewCheckoutFlow": false,
    "AdvancedSearch": true,
    "BetaFeatures": false
  }
}
```

### Verificar Feature

```bash
GET /api/featureflags/NewCheckoutFlow
Authorization: Bearer {token}
```

### Habilitar Feature

```bash
POST /api/featureflags/NewCheckoutFlow/enable
Authorization: Bearer {token}
```

### Deshabilitar Feature

```bash
POST /api/featureflags/NewCheckoutFlow/disable
Authorization: Bearer {token}
```

## Mejores Prácticas

1. **Nombres Descriptivos**: Usar nombres claros como `NewCheckoutFlow`, `BetaFeatures`
2. **Documentar Features**: Documentar qué hace cada feature flag
3. **Limpiar Flags Antiguos**: Remover flags que ya no se usan
4. **Monitorear Uso**: Revisar logs para ver qué features están activas
5. **Testing**: Probar con flags habilitados y deshabilitados
6. **Rollback Plan**: Tener un plan para deshabilitar rápidamente si hay problemas

## Troubleshooting

### Feature no se habilita

- Verificar configuración en `appsettings.json`
- Verificar que el nombre sea exacto (case-sensitive)
- Verificar fechas si están configuradas
- Verificar percentage si está configurado

### Feature habilitada pero no funciona

- Verificar que el código esté usando el flag correctamente
- Verificar logs para ver si hay errores
- Verificar que el endpoint esté usando el atributo correcto

### Percentage no funciona como esperado

- El percentage usa el userId como seed, así que es consistente por usuario
- Verificar que el userId esté disponible en el contexto

## Referencias

- [Feature Toggles (Martin Fowler)](https://martinfowler.com/articles/feature-toggles.html)
- [Feature Flags Best Practices](https://launchdarkly.com/blog/feature-flag-best-practices/)
