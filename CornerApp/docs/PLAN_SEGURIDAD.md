# Plan de Implementación de Mejoras de Seguridad

## Fase 1: Correcciones Críticas (Prioridad Máxima)

### 1.1 CORS - Validación de Orígenes en Producción

**Problema**: Valores por defecto de desarrollo pueden permitir orígenes no autorizados.

**Solución**:
1. Eliminar valores por defecto en producción
2. Validar configuración al iniciar
3. Documentar orígenes permitidos

**Archivos a modificar**:
- `backend-csharp/CornerApp.API/Program.cs`

**Pasos**:
1. Agregar validación de orígenes permitidos al iniciar
2. Lanzar excepción si no hay configuración en producción
3. Actualizar `appsettings.Production.json` con orígenes reales

**Código de ejemplo**:
```csharp
// En Program.cs, después de obtener allowedOrigins
if (!builder.Environment.IsDevelopment())
{
    if (allowedOrigins == null || allowedOrigins.Length == 0)
    {
        throw new InvalidOperationException(
            "CORS: AllowedOrigins debe estar configurado en producción. " +
            "Configure la variable de entorno Cors__AllowedOrigins o en appsettings.Production.json");
    }
    
    // Validar que no sean localhost en producción
    var hasLocalhost = allowedOrigins.Any(o => 
        o.Contains("localhost", StringComparison.OrdinalIgnoreCase) ||
        o.Contains("127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
        o.StartsWith("http://", StringComparison.OrdinalIgnoreCase));
    
    if (hasLocalhost)
    {
        throw new InvalidOperationException(
            "CORS: No se permiten orígenes localhost en producción por seguridad.");
    }
}
```

**Configuración requerida**:
```json
// appsettings.Production.json
{
  "Cors": {
    "AllowedOrigins": [
      "https://cornerapp.com",
      "https://www.cornerapp.com",
      "https://admin.cornerapp.com"
    ],
    "AllowCredentials": true,
    "MaxAge": 3600
  }
}
```

**Variables de entorno**:
```bash
Cors__AllowedOrigins__0=https://cornerapp.com
Cors__AllowedOrigins__1=https://www.cornerapp.com
```

---

### 1.2 Eliminar o Restringir Política CORS "PublicApi"

**Problema**: `AllowAnyOrigin()` permite cualquier origen, riesgo de CSRF.

**Solución**:
1. Eliminar la política si no se usa
2. Si se necesita, restringir orígenes específicos

**Archivos a modificar**:
- `backend-csharp/CornerApp.API/Program.cs`

**Pasos**:
1. Buscar uso de política "PublicApi" en el código
2. Si no se usa, eliminar la política
3. Si se usa, restringir orígenes

**Código de ejemplo**:
```csharp
// Opción 1: Eliminar si no se usa
// Eliminar el bloque completo de "PublicApi"

// Opción 2: Si se necesita, restringir
options.AddPolicy("PublicApi", policy =>
{
    // Solo orígenes específicos
    policy.WithOrigins(allowedOrigins)
          .AllowAnyMethod()
          .AllowAnyHeader()
          .WithExposedHeaders("X-Request-Id", "ETag");
});
```

---

### 1.3 Almacenamiento Seguro de Tokens en App Móvil

**Problema**: Tokens almacenados en texto plano en AsyncStorage.

**Solución**: Usar `expo-secure-store` para almacenamiento encriptado.

**Archivos a modificar**:
- `redux/slices/authSlice.js`
- `services/api.js`
- `package.json` (agregar dependencia)

**Pasos**:
1. Instalar `expo-secure-store`
2. Crear servicio de almacenamiento seguro
3. Reemplazar AsyncStorage por SecureStore en tokens
4. Mantener AsyncStorage solo para datos no sensibles

**Instalación**:
```bash
cd /ruta/a/CornerApp
npx expo install expo-secure-store
```

**Código de ejemplo**:
```javascript
// services/secureStorage.js (nuevo archivo)
import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'authToken';
const USER_KEY = 'user';
const USER_ROLE_KEY = 'userRole';

export const secureStorage = {
  async setToken(token) {
    try {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    } catch (error) {
      console.error('Error guardando token:', error);
      throw error;
    }
  },

  async getToken() {
    try {
      return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    } catch (error) {
      console.error('Error obteniendo token:', error);
      return null;
    }
  },

  async removeToken() {
    try {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    } catch (error) {
      console.error('Error eliminando token:', error);
    }
  },

  async setUser(user) {
    try {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error guardando usuario:', error);
      throw error;
    }
  },

  async getUser() {
    try {
      const userStr = await SecureStore.getItemAsync(USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      return null;
    }
  },

  async removeUser() {
    try {
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (error) {
      console.error('Error eliminando usuario:', error);
    }
  },

  async setRole(role) {
    try {
      await SecureStore.setItemAsync(USER_ROLE_KEY, role);
    } catch (error) {
      console.error('Error guardando rol:', error);
      throw error;
    }
  },

  async getRole() {
    try {
      return await SecureStore.getItemAsync(USER_ROLE_KEY);
    } catch (error) {
      console.error('Error obteniendo rol:', error);
      return null;
    }
  },

  async removeRole() {
    try {
      await SecureStore.deleteItemAsync(USER_ROLE_KEY);
    } catch (error) {
      console.error('Error eliminando rol:', error);
    }
  },

  async clearAll() {
    await Promise.all([
      this.removeToken(),
      this.removeUser(),
      this.removeRole()
    ]);
  }
};
```

**Actualizar authSlice.js**:
```javascript
// Reemplazar imports
import { secureStorage } from '../../services/secureStorage';

// Reemplazar todas las llamadas a AsyncStorage
// Antes:
await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);

// Después:
await secureStorage.setToken(response.token);
```

**Actualizar api.js**:
```javascript
// Reemplazar import
import { secureStorage } from './secureStorage';

// En el interceptor:
apiClient.interceptors.request.use(
  async (config) => {
    const token = await secureStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  // ...
);
```

---

### 1.4 Configurar URL de Producción Correctamente

**Problema**: URL hardcodeada y placeholder no actualizado.

**Solución**: Usar variables de entorno de Expo.

**Archivos a modificar**:
- `services/api.js`
- `constants/api.js`
- `.env` (crear si no existe)
- `app.json` (opcional, para configuración)

**Pasos**:
1. Crear archivo `.env` con variables
2. Configurar `EXPO_PUBLIC_API_URL`
3. Actualizar código para usar variable de entorno
4. Documentar configuración

**Código de ejemplo**:
```javascript
// services/api.js
// Reemplazar la función getBaseUrl
const getBaseUrl = async () => {
  // Prioridad: Variable de entorno > Detección automática > Default
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  
  if (envUrl) {
    console.log('🌐 Usando URL de API desde variable de entorno:', envUrl);
    return envUrl;
  }

  if (__DEV__) {
    // Lógica de detección automática existente
    const ip = await getLocalIP();
    return `http://${ip}:5000`;
  }
  
  // Fallback: error en producción si no está configurado
  throw new Error(
    'EXPO_PUBLIC_API_URL no está configurada. ' +
    'Configura la variable de entorno antes de construir la app.'
  );
};
```

**Archivo .env**:
```bash
# Desarrollo
EXPO_PUBLIC_API_URL=http://192.168.1.7:5000

# Producción (usar en build)
# EXPO_PUBLIC_API_URL=https://api.cornerapp.com
```

**Nota**: Expo requiere reiniciar el servidor después de cambiar variables de entorno.

---

## Fase 2: Mejoras de Alta Prioridad

### 2.1 Reducir Expiración de Tokens JWT y Agregar Refresh Tokens

**Problema**: Tokens válidos por 30 días, demasiado tiempo.

**Solución**:
1. Reducir expiración a 15 minutos - 1 hora
2. Implementar refresh tokens con expiración de 7-30 días
3. Actualizar cliente móvil para renovar automáticamente

**Archivos a modificar**:
- `backend-csharp/CornerApp.API/Controllers/AuthController.cs`
- `backend-csharp/CornerApp.API/Models/Customer.cs` (agregar RefreshToken)
- `backend-csharp/CornerApp.API/Models/Admin.cs` (agregar RefreshToken)
- `backend-csharp/CornerApp.API/Migrations/` (nueva migración)
- `services/auth.js` (app móvil)
- `services/api.js` (interceptor para refresh)

**Pasos Backend**:

1. **Agregar RefreshToken a modelos**:
```csharp
// Models/Customer.cs
public class Customer
{
    // ... propiedades existentes
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }
}

// Models/Admin.cs
public class Admin
{
    // ... propiedades existentes
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }
}
```

2. **Crear migración**:
```bash
cd backend-csharp/CornerApp.API
dotnet ef migrations add AddRefreshTokens
dotnet ef database update
```

3. **Actualizar AuthController**:
```csharp
// Generar token de acceso (15 minutos)
private string GenerateJwtToken(Customer customer)
{
    // ... código existente
    var token = new JwtSecurityToken(
        issuer: jwtIssuer,
        audience: jwtAudience,
        claims: claims,
        expires: DateTime.UtcNow.AddMinutes(15), // Reducido de 30 días
        signingCredentials: credentials
    );
    return new JwtSecurityTokenHandler().WriteToken(token);
}

// Generar refresh token
private string GenerateRefreshToken()
{
    var randomNumber = new byte[64];
    using var rng = RandomNumberGenerator.Create();
    rng.GetBytes(randomNumber);
    return Convert.ToBase64String(randomNumber);
}

// Guardar refresh token
private async Task SaveRefreshTokenAsync(Customer customer, string refreshToken)
{
    customer.RefreshToken = refreshToken;
    customer.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
    await _context.SaveChangesAsync();
}

// Endpoint para refresh token
[HttpPost("refresh")]
public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
{
    if (string.IsNullOrWhiteSpace(request.RefreshToken))
    {
        return BadRequest(new { error = "Refresh token es requerido" });
    }

    var customer = await _context.Customers
        .FirstOrDefaultAsync(c => c.RefreshToken == request.RefreshToken);

    if (customer == null || 
        customer.RefreshTokenExpiryTime <= DateTime.UtcNow)
    {
        return Unauthorized(new { error = "Refresh token inválido o expirado" });
    }

    // Generar nuevo token de acceso
    var newAccessToken = GenerateJwtToken(customer);
    var newRefreshToken = GenerateRefreshToken();
    
    // Guardar nuevo refresh token
    await SaveRefreshTokenAsync(customer, newRefreshToken);

    return Ok(new
    {
        token = newAccessToken,
        refreshToken = newRefreshToken
    });
}
```

**Pasos App Móvil**:

1. **Actualizar auth.js**:
```javascript
// Guardar ambos tokens
export const login = async (email, password) => {
  const response = await apiClient.post('/api/auth/login', {
    Email: email,
    Password: password,
  });
  
  // Guardar ambos tokens
  await secureStorage.setToken(response.data.token);
  if (response.data.refreshToken) {
    await secureStorage.setRefreshToken(response.data.refreshToken);
  }
  
  return response.data;
};

// Función para refrescar token
export const refreshToken = async () => {
  const refreshToken = await secureStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error('No hay refresh token disponible');
  }

  const response = await apiClient.post('/api/auth/refresh', {
    refreshToken: refreshToken
  });

  await secureStorage.setToken(response.data.token);
  if (response.data.refreshToken) {
    await secureStorage.setRefreshToken(response.data.refreshToken);
  }

  return response.data.token;
};
```

2. **Actualizar interceptor de api.js**:
```javascript
// Interceptor para manejar 401 y refrescar token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si es 401 y no es un retry, intentar refrescar token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Si falla el refresh, hacer logout
        await secureStorage.clearAll();
        // Redirigir a login (depende de tu navegación)
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

---

### 2.2 Eliminar Admin por Defecto en Producción

**Problema**: Credenciales por defecto se crean automáticamente.

**Solución**: Solo crear admin por defecto en desarrollo.

**Archivos a modificar**:
- `backend-csharp/CornerApp.API/Program.cs`

**Código de ejemplo**:
```csharp
// Aplicar migraciones automáticamente al iniciar (solo en desarrollo)
if (app.Environment.IsDevelopment())
{
    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        try
        {
            dbContext.Database.Migrate();
            
            // Crear admin por defecto SOLO en desarrollo
            var existingAdmin = await dbContext.Admins.FirstOrDefaultAsync();
            if (existingAdmin == null)
            {
                var admin = new CornerApp.API.Models.Admin
                {
                    Username = "admin",
                    Email = "admin@cornerapp.com",
                    Name = "Administrador",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                    CreatedAt = DateTime.UtcNow
                };
                dbContext.Admins.Add(admin);
                await dbContext.SaveChangesAsync();
                Log.Information("✅ Administrador por defecto creado: usuario 'admin', contraseña 'admin123'");
            }
        }
        catch (Exception ex)
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
            logger.LogError(ex, "Error al aplicar migraciones o crear admin");
        }
    }
}
else
{
    // En producción, solo aplicar migraciones, NO crear admin
    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        try
        {
            dbContext.Database.Migrate();
            Log.Information("Migraciones aplicadas en producción");
        }
        catch (Exception ex)
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
            logger.LogError(ex, "Error al aplicar migraciones en producción");
            throw; // En producción, fallar si no se pueden aplicar migraciones
        }
    }
}
```

**Alternativa**: Crear script de inicialización separado para producción.

---

### 2.3 Eliminar Logs con Datos Sensibles

**Problema**: Logs contienen información personal (nombres, teléfonos, direcciones).

**Solución**: Sanitizar o eliminar logs en producción.

**Archivos a modificar**:
- `services/api.js`
- Cualquier otro archivo con `console.log` de datos sensibles

**Código de ejemplo**:
```javascript
// Crear helper para logging seguro
const isProduction = !__DEV__;

const safeLog = {
  info: (message, data) => {
    if (!isProduction) {
      console.log(message, data);
    } else {
      // En producción, solo loguear sin datos sensibles
      console.log(message);
    }
  },
  
  error: (message, error) => {
    // Errores siempre se loguean, pero sin datos sensibles
    console.error(message, {
      status: error?.response?.status,
      // NO incluir: error.response.data (puede tener datos sensibles)
    });
  }
};

// Reemplazar console.log en createOrder
export const createOrder = async (orderData) => {
  try {
    // ... código existente
    
    // Antes:
    // console.log('📤 Creando pedido con datos:', { CustomerName, CustomerPhone, ... });
    
    // Después:
    safeLog.info('📤 Creando pedido', {
      itemsCount: requestData.Items.length,
      paymentMethod: requestData.PaymentMethod,
      // NO incluir: CustomerName, CustomerPhone, CustomerAddress
    });

    const response = await apiClient.post('/api/orders', requestData);
    safeLog.info('✅ Pedido creado exitosamente', { orderId: response.data.id });
    return response.data;
  } catch (error) {
    safeLog.error('❌ Error creating order:', error);
    // ... resto del manejo de errores
  }
};
```

**Alternativa**: Usar librería de logging como `react-native-logs` con niveles.

---

### 2.4 Validación de Entrada Más Robusta

**Problema**: Validación básica, puede mejorarse con Data Annotations o FluentValidation.

**Solución**: Implementar FluentValidation para DTOs críticos.

**Archivos a modificar**:
- Agregar paquete FluentValidation
- Crear validadores para DTOs
- `backend-csharp/CornerApp.API/DTOs/OrderDTOs.cs`
- `backend-csharp/CornerApp.API/DTOs/AuthDTOs.cs`

**Instalación**:
```bash
cd backend-csharp/CornerApp.API
dotnet add package FluentValidation.AspNetCore
```

**Código de ejemplo**:
```csharp
// Validators/CreateOrderRequestValidator.cs
using FluentValidation;
using CornerApp.API.DTOs;

public class CreateOrderRequestValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderRequestValidator()
    {
        RuleFor(x => x.CustomerName)
            .NotEmpty().WithMessage("El nombre del cliente es requerido")
            .MaximumLength(100).WithMessage("El nombre no puede exceder 100 caracteres")
            .Matches(@"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$").WithMessage("El nombre solo puede contener letras");

        RuleFor(x => x.CustomerPhone)
            .Matches(@"^\+?[1-9]\d{1,14}$").WithMessage("Formato de teléfono inválido")
            .When(x => !string.IsNullOrEmpty(x.CustomerPhone));

        RuleFor(x => x.CustomerEmail)
            .EmailAddress().WithMessage("Formato de email inválido")
            .When(x => !string.IsNullOrEmpty(x.CustomerEmail));

        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("El pedido debe contener al menos un item")
            .Must(items => items.All(i => i.Quantity > 0)).WithMessage("La cantidad debe ser mayor a 0")
            .Must(items => items.All(i => i.Price >= 0)).WithMessage("El precio no puede ser negativo");

        RuleForEach(x => x.Items)
            .SetValidator(new OrderItemValidator());
    }
}

public class OrderItemValidator : AbstractValidator<OrderItemDTO>
{
    public OrderItemValidator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0).WithMessage("El ID del producto debe ser mayor a 0");

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithMessage("La cantidad debe ser mayor a 0")
            .LessThanOrEqualTo(50).WithMessage("La cantidad no puede exceder 50");

        RuleFor(x => x.Price)
            .GreaterThanOrEqualTo(0).WithMessage("El precio no puede ser negativo");
    }
}
```

**Registrar en Program.cs**:
```csharp
builder.Services.AddControllers()
    .AddFluentValidation(fv => 
    {
        fv.RegisterValidatorsFromAssemblyContaining<Program>();
        fv.AutomaticValidationEnabled = true;
    });
```

---

## Fase 3: Mejoras de Prioridad Media (Opcional pero Recomendado)

### 3.1 SSL Pinning en App Móvil

**Problema**: No se valida certificado SSL, riesgo de Man-in-the-Middle.

**Solución**: Implementar SSL pinning con `react-native-ssl-pinning` o similar.

**Nota**: Requiere configuración del certificado del servidor.

---

### 3.2 Configurar Content-Security-Policy

**Problema**: CSP deshabilitado por defecto.

**Solución**: Configurar CSP apropiado para la aplicación.

**Archivos a modificar**:
- `backend-csharp/CornerApp.API/appsettings.json`
- `backend-csharp/CornerApp.API/Middleware/SecurityHeadersMiddleware.cs`

**Código de ejemplo**:
```json
// appsettings.json
{
  "SecurityHeaders": {
    "EnableContentSecurityPolicy": true,
    "ContentSecurityPolicyValue": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.cornerapp.com;"
  }
}
```

---

## Checklist de Implementación

### Fase 1 (Crítico) - Completar antes de producción
- [ ] Validar CORS en producción
- [ ] Eliminar/restringir política PublicApi
- [ ] Implementar SecureStore para tokens
- [ ] Configurar URL de producción con variables de entorno

### Fase 2 (Alta Prioridad) - Completar en las primeras semanas
- [ ] Reducir expiración de tokens JWT
- [ ] Implementar refresh tokens
- [ ] Eliminar admin por defecto en producción
- [ ] Eliminar logs con datos sensibles
- [ ] Implementar FluentValidation

### Fase 3 (Media Prioridad) - Planificar para siguientes sprints
- [ ] SSL Pinning
- [ ] Content-Security-Policy
- [ ] CSRF tokens (si aplica)
- [ ] Auditoría de acciones sensibles

---

## Orden de Implementación Recomendado

1. **Semana 1**: Fase 1 completa
2. **Semana 2**: Fase 2.1 y 2.2 (Tokens y Admin)
3. **Semana 3**: Fase 2.3 y 2.4 (Logs y Validación)
4. **Semana 4+**: Fase 3 según prioridades del negocio

---

## Testing de Seguridad

Después de implementar cada fase:

1. **CORS**: Verificar que solo orígenes permitidos funcionen
2. **Tokens**: Verificar que SecureStore funcione en iOS y Android
3. **Refresh Tokens**: Probar renovación automática
4. **Validación**: Probar con datos maliciosos (SQL injection, XSS, etc.)
5. **Logs**: Verificar que no se expongan datos sensibles en producción

---

## Documentación Adicional

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [ASP.NET Core Security](https://docs.microsoft.com/en-us/aspnet/core/security/)

---

**Última actualización**: 2024
**Responsable**: Equipo de Desarrollo
**Revisión**: Cada 3 meses

