using CornerApp.API.Services;
using CornerApp.API.Controllers;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Middleware;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using HealthChecks.UI.Client;
using AspNetCoreRateLimit;
using Serilog;
using Serilog.Events;
using Prometheus;

// Configurar Serilog antes de crear el builder
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    .MinimumLevel.Override("System", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .Enrich.WithEnvironmentName()
    .Enrich.WithMachineName()
    .Enrich.WithThreadId()
    .WriteTo.Console(
        outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .WriteTo.File(
        path: "logs/cornerapp-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}",
        shared: true)
    .CreateLogger();

try
{
    Log.Information("Iniciando CornerApp API");

var builder = WebApplication.CreateBuilder(args);
    
    // Usar Serilog en lugar del logger por defecto
    builder.Host.UseSerilog();

// Agregar compresión de respuestas
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
    options.MimeTypes = Microsoft.AspNetCore.ResponseCompression.ResponseCompressionDefaults.MimeTypes.Concat(
        new[] { "application/json", "text/json", "application/problem+json" });
});

builder.Services.Configure<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProviderOptions>(options =>
{
    options.Level = System.IO.Compression.CompressionLevel.Optimal;
});

builder.Services.Configure<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProviderOptions>(options =>
{
    options.Level = System.IO.Compression.CompressionLevel.Optimal;
});

// Configurar límites de request para protección
var maxRequestBodySize = builder.Configuration.GetValue<long>("RequestLimits:MaxRequestBodySize", 10 * 1024 * 1024);
var maxRequestHeadersSize = builder.Configuration.GetValue<int>("RequestLimits:MaxRequestHeadersTotalSize", 32 * 1024);
var maxRequestHeaderCount = builder.Configuration.GetValue<int>("RequestLimits:MaxRequestHeaderCount", 100);
var keepAliveTimeout = builder.Configuration.GetValue<int>("RequestLimits:KeepAliveTimeoutSeconds", 120);
var requestHeadersTimeout = builder.Configuration.GetValue<int>("RequestLimits:RequestHeadersTimeoutSeconds", 30);

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = maxRequestBodySize;
    options.Limits.MaxRequestHeadersTotalSize = maxRequestHeadersSize;
    options.Limits.MaxRequestHeaderCount = maxRequestHeaderCount;
    options.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(keepAliveTimeout);
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(requestHeadersTimeout);
});

// Agregar servicios con Content Negotiation mejorado
builder.Services.AddControllers(options =>
{
    // Configurar Content Negotiation
    options.RespectBrowserAcceptHeader = true;
    options.ReturnHttpNotAcceptable = true; // Retornar 406 si el formato no es aceptable
    
    // Agregar formatters personalizados si es necesario
    // Por defecto, ASP.NET Core soporta JSON y XML
})
    .AddJsonOptions(options =>
    {
        // Evitar referencias circulares en JSON (Category -> Products -> Category)
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.WriteIndented = true;
        
        // Configuración adicional de JSON
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    })
    .AddXmlSerializerFormatters() // Soporte para XML si el cliente lo solicita
    .ConfigureApiBehaviorOptions(options =>
    {
        // Personalizar respuestas de validación
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .SelectMany(x => x.Value!.Errors.Select(e => new CornerApp.API.Middleware.ValidationError
                {
                    Field = x.Key,
                    Message = e.ErrorMessage ?? "Error de validación",
                    AttemptedValue = x.Value.AttemptedValue
                }))
                .ToList();

            var response = new CornerApp.API.Middleware.ErrorResponse
            {
                Success = false,
                Message = "Error de validación en los datos enviados",
                ErrorCode = "VALIDATION_ERROR",
                ValidationErrors = errors
            };

            return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(response);
        };
    });
builder.Services.AddEndpointsApiExplorer();

// Configurar Swagger solo si está habilitado
var enableSwaggerConfig = builder.Configuration.GetValue<bool>("EnableSwagger", false);
if (builder.Environment.IsDevelopment() || enableSwaggerConfig)
{
    builder.Services.AddSwaggerGen(options =>
    {
        options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
        {
            Title = "CornerApp API",
            Version = "v1.0",
            Description = @"
API REST para la gestión completa de pedidos de CornerApp.

## Características principales:
- Gestión de productos y categorías
- Creación y seguimiento de pedidos
- Autenticación JWT para clientes y repartidores
- Dashboard administrativo
- Sistema de puntos y recompensas
- Tracking de entregas en tiempo real

## Autenticación:
La mayoría de los endpoints requieren autenticación JWT. Obtén un token usando los endpoints de autenticación y luego inclúyelo en el header:
```
Authorization: Bearer {tu_token}
```

## Rate Limiting:
La API implementa rate limiting para proteger contra abuso. Los límites varían según el endpoint.
",
            Contact = new Microsoft.OpenApi.Models.OpenApiContact
            {
                Name = "Soporte CornerApp",
                Email = "soporte@cornerapp.com"
            },
            License = new Microsoft.OpenApi.Models.OpenApiLicense
            {
                Name = "Propietario",
                Url = new Uri("https://cornerapp.com/license")
            },
            TermsOfService = new Uri("https://cornerapp.com/terms")
        });
        
        // Habilitar comentarios XML para documentación
        var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
        var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
        if (File.Exists(xmlPath))
        {
            options.IncludeXmlComments(xmlPath);
        }
        
        // Agregar seguridad JWT a Swagger
        options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
        {
            Description = @"JWT Authorization header usando el esquema Bearer. 
Ingresa 'Bearer' [espacio] y luego tu token en el campo de abajo.
Ejemplo: 'Bearer 12345abcdef'",
            Name = "Authorization",
            In = Microsoft.OpenApi.Models.ParameterLocation.Header,
            Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
            Scheme = "Bearer",
            BearerFormat = "JWT"
        });
        
        options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
        {
            {
                new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Reference = new Microsoft.OpenApi.Models.OpenApiReference
                    {
                        Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                        Id = "Bearer"
                    }
                },
                Array.Empty<string>()
            }
        });
        
        // Agregar tags para agrupar endpoints
        options.TagActionsBy(api => new[] { api.GroupName ?? api.ActionDescriptor.RouteValues["controller"] ?? "Default" });
        options.DocInclusionPredicate((name, api) => true);
        
        // Personalizar esquemas
        options.CustomSchemaIds(type => type.FullName?.Replace("+", "."));
        
        // Agregar ejemplos y descripciones mejoradas
        options.SupportNonNullableReferenceTypes();
        options.UseAllOfToExtendReferenceSchemas();
        options.SupportNonNullableReferenceTypes();
    });
}

// Registrar servicio de secretos
builder.Services.AddSingleton<ISecretsService, SecretsService>();

// Configurar Entity Framework Core
// Prioridad: SecretsService > Variable de entorno CONNECTION_STRING > appsettings.json
// Nota: Usamos Task.Run para evitar deadlocks en la inicialización
var tempServiceProvider = builder.Services.BuildServiceProvider();
var secretsService = tempServiceProvider.GetRequiredService<ISecretsService>();
var connectionString = Task.Run(async () => await secretsService.GetSecretAsync("ConnectionStrings:DefaultConnection")).Result
    ?? builder.Configuration["CONNECTION_STRING"] 
    ?? builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string no configurado. Configure la variable de entorno CONNECTION_STRING o el valor en appsettings.json");

// Para SQL Server (producción y desarrollo con SSMS)
// Configuración optimizada para producción con connection pooling
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        // Habilitar retry logic para resiliencia
        sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(5),
            errorNumbersToAdd: null);
        
        // Configuración de comandos
        sqlOptions.CommandTimeout(30); // 30 segundos timeout por defecto
        
        // Habilitar sensitive data logging solo en desarrollo
        if (builder.Environment.IsDevelopment())
        {
            options.EnableSensitiveDataLogging();
            options.EnableDetailedErrors();
        }
    });
    
    // Configuración de query tracking
    // Nota: Se recomienda usar AsNoTracking() explícitamente en consultas de solo lectura
    // para mejorar el rendimiento y reducir el uso de memoria y conexiones
    options.UseQueryTrackingBehavior(QueryTrackingBehavior.TrackAll);
    
    // Nota: Lazy loading está deshabilitado por defecto (mejor performance, más explícito)
    // Usar Include() explícitamente cuando se necesiten datos relacionados
});

// Para SQLite (desarrollo sin servidor)
// builder.Services.AddDbContext<ApplicationDbContext>(options =>
//     options.UseSqlite(connectionString));

// Configurar CORS con optimizaciones
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
    ?? new[] { "http://localhost:3000", "http://localhost:19006", "exp://localhost:19000" };
var allowCredentials = builder.Configuration.GetValue<bool>("Cors:AllowCredentials", false);
var maxAge = builder.Configuration.GetValue<int>("Cors:MaxAge", 3600); // 1 hora por defecto

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactNative", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            // En desarrollo, permitir cualquier origen para facilitar pruebas desde móviles
            // Usamos SetIsOriginAllowed para permitir cualquier origen incluso con AllowCredentials
            policy.SetIsOriginAllowed(_ => true)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials() // Necesario para SignalR
                  .WithExposedHeaders("X-Request-Id", "ETag", "Content-Length", "Content-Type");
        }
        else
        {
            // En producción, solo orígenes específicos con configuración optimizada
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials() // Necesario para SignalR
                  .WithExposedHeaders("X-Request-Id", "ETag", "Content-Length", "Content-Type")
                  .SetPreflightMaxAge(TimeSpan.FromSeconds(maxAge));
        }
    });
    
    // Política adicional para APIs públicas (sin autenticación)
    options.AddPolicy("PublicApi", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader()
              .WithExposedHeaders("X-Request-Id", "ETag");
    });
});

// Configurar JWT Authentication
// Prioridad: SecretsService > Variable de entorno > appsettings.json > valor por defecto (solo desarrollo)
// Nota: Usamos Task.Run para evitar deadlocks en la inicialización
var jwtKey = Task.Run(async () => await secretsService.GetSecretAsync("JWT_SECRET_KEY")).Result
    ?? builder.Configuration["JWT_SECRET_KEY"] 
    ?? builder.Configuration["Jwt:Key"] 
    ?? (builder.Environment.IsDevelopment() 
        ? "your-secret-key-that-is-at-least-32-characters-long-for-security-development-only" 
        : throw new InvalidOperationException("JWT Secret Key no configurado. Configure la variable de entorno JWT_SECRET_KEY o el valor en appsettings.json"));

var jwtIssuer = builder.Configuration["JWT_ISSUER"] 
    ?? builder.Configuration["Jwt:Issuer"] 
    ?? "CornerApp";

var jwtAudience = builder.Configuration["JWT_AUDIENCE"] 
    ?? builder.Configuration["Jwt:Audience"] 
    ?? "CornerApp";

// Validar que la clave tenga al menos 32 caracteres en producción
if (!builder.Environment.IsDevelopment() && (jwtKey == null || jwtKey.Length < 32))
{
    throw new InvalidOperationException("JWT Secret Key debe tener al menos 32 caracteres en producción.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization(options =>
{
    // Política para administradores
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
    
    // Por defecto, requerir autenticación para endpoints admin
    options.FallbackPolicy = null; // No requerir autenticación por defecto (solo donde se especifique)
});

// Configurar Response Caching (HTTP Cache Headers)
builder.Services.AddResponseCaching(options =>
{
    options.MaximumBodySize = 64 * 1024 * 1024; // 64 MB
    options.SizeLimit = 100 * 1024 * 1024; // 100 MB
    options.UseCaseSensitivePaths = false;
});

// Configurar Cache: Redis (Distributed Cache) si está disponible, sino Memory Cache
var redisConnectionString = builder.Configuration.GetConnectionString("Redis")
    ?? builder.Configuration["Redis:ConnectionString"];

if (!string.IsNullOrEmpty(redisConnectionString))
{
    // Usar Redis como Distributed Cache
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisConnectionString;
        options.InstanceName = builder.Configuration["Redis:InstanceName"] ?? "CornerApp:";
    });
    
    // También mantener Memory Cache como fallback
    builder.Services.AddMemoryCache(options =>
    {
        options.SizeLimit = 1024;
    });
    
    Log.Information("Redis configurado como Distributed Cache: {ConnectionString}", 
        redisConnectionString.Replace("password=", "password=***"));
}
else
{
    // Solo Memory Cache si Redis no está configurado
    builder.Services.AddMemoryCache(options =>
    {
        options.SizeLimit = 1024; // Límite de tamaño en MB
    });
    
    Log.Information("Usando Memory Cache (Redis no configurado)");
}

// Registrar CacheService unificado
builder.Services.AddSingleton<ICacheService, CacheService>();

// Agregar servicios de Background Jobs/Tasks
builder.Services.AddSingleton<IBackgroundTaskQueue, BackgroundTaskQueue>();
builder.Services.AddHostedService<QueuedHostedService>();

// Registrar Message Queue (RabbitMQ)
var rabbitMQEnabled = builder.Configuration.GetValue<bool>("RabbitMQ:Enabled", false);
if (rabbitMQEnabled)
{
    builder.Services.AddSingleton<IMessageQueueService, RabbitMQService>();
    builder.Services.AddHostedService<OrderMessageConsumer>();
    Log.Information("RabbitMQ habilitado y servicios registrados");
}
else
{
    // Implementación dummy para cuando RabbitMQ está deshabilitado
    builder.Services.AddSingleton<IMessageQueueService, DummyMessageQueueService>();
    Log.Information("RabbitMQ deshabilitado, usando DummyMessageQueueService");
}

// Cache Cleanup Service (solo si está habilitado)
var enableBackgroundJobs = builder.Configuration.GetValue<bool>("BackgroundJobs:EnableBackgroundJobs", true);
var enableCacheCleanup = builder.Configuration.GetValue<bool>("BackgroundJobs:CacheCleanup:Enabled", true);
if (enableBackgroundJobs && enableCacheCleanup)
{
    builder.Services.AddHostedService<CacheCleanupService>();
}

// Database Backup Service
var enableBackup = builder.Configuration.GetValue<bool>("Backup:Enabled", false);
if (enableBackup)
{
    builder.Services.AddSingleton<IDatabaseBackupService, DatabaseBackupService>();
    builder.Services.AddHostedService<DatabaseBackupBackgroundService>();
    Log.Information("Database Backup Service habilitado");
}

// Servicio de procesamiento de pedidos
builder.Services.AddScoped<OrderProcessingService>();

// Servicio de horarios de negocio (Scoped porque necesita DbContext)
builder.Services.AddScoped<IBusinessHoursService, BusinessHoursService>();

// Servicio de dashboard de administración
builder.Services.AddScoped<IAdminDashboardService, AdminDashboardService>();

// Servicio de subida de archivos
builder.Services.AddScoped<IFileUploadService, FileUploadService>();

// Servicio de email
builder.Services.AddScoped<IEmailService, EmailService>();

// SignalR para notificaciones en tiempo real
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
})
.AddJsonProtocol(options =>
{
    // Usar la misma configuración de serialización JSON que los controllers
    options.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.PayloadSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.PayloadSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    options.PayloadSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
});
builder.Services.AddSingleton<CornerApp.API.Hubs.IOrderNotificationService, CornerApp.API.Hubs.OrderNotificationService>();

// Circuit Breaker Factory
builder.Services.AddSingleton<CircuitBreakerFactory>();

// Feature Flags Service
builder.Services.AddSingleton<IFeatureFlagsService, FeatureFlagsService>();

// Retry Policy Factory
builder.Services.AddSingleton<RetryPolicyFactory>();

// Audit Service
builder.Services.AddScoped<IAuditService, AuditService>();

// Webhook Service
builder.Services.AddHttpClient(); // Para webhooks
builder.Services.AddScoped<IWebhookService, WebhookService>();

// Configurar Rate Limiting
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimiting"));
builder.Services.AddSingleton<IIpPolicyStore, MemoryCacheIpPolicyStore>();
builder.Services.AddSingleton<IRateLimitCounterStore, MemoryCacheRateLimitCounterStore>();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
builder.Services.AddSingleton<IProcessingStrategy, AsyncKeyLockProcessingStrategy>();
builder.Services.AddInMemoryRateLimiting();

// Registrar servicio de métricas
builder.Services.AddSingleton<IMetricsService, MetricsService>();

// Configurar Health Checks
var healthChecksBuilder = builder.Services.AddHealthChecks()
    .AddDbContextCheck<ApplicationDbContext>(
        name: "database",
        failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Unhealthy,
        tags: new[] { "db", "sql", "ready" })
    .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy("API is healthy"), tags: new[] { "self" });

// Agregar health checks personalizados
var enableCacheHealthCheck = builder.Configuration.GetValue<bool>("HealthChecks:Cache:Enabled", true);
if (enableCacheHealthCheck)
{
    healthChecksBuilder.AddCheck<CornerApp.API.HealthChecks.CacheHealthCheck>(
        "cache",
        failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Degraded,
        tags: new[] { "cache", "memory" });
}

var enableDiskSpaceHealthCheck = builder.Configuration.GetValue<bool>("HealthChecks:DiskSpace:Enabled", true);
if (enableDiskSpaceHealthCheck)
{
    healthChecksBuilder.AddCheck<CornerApp.API.HealthChecks.DiskSpaceHealthCheck>(
        "disk_space",
        failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Degraded,
        tags: new[] { "disk", "storage" });
}

var enableMemoryHealthCheck = builder.Configuration.GetValue<bool>("HealthChecks:Memory:Enabled", true);
if (enableMemoryHealthCheck)
{
    healthChecksBuilder.AddCheck<CornerApp.API.HealthChecks.MemoryHealthCheck>(
        "memory",
        failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Degraded,
        tags: new[] { "memory", "resources" });
}

var enableExternalApiHealthCheck = builder.Configuration.GetValue<bool>("HealthChecks:ExternalApi:Enabled", false);
if (enableExternalApiHealthCheck)
{
    builder.Services.AddHttpClient<CornerApp.API.HealthChecks.ExternalApiHealthCheck>();
    healthChecksBuilder.AddCheck<CornerApp.API.HealthChecks.ExternalApiHealthCheck>(
        "external_api",
        failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Degraded,
        tags: new[] { "external", "api" });
}

// Configurar opciones de DeliveryZone desde appsettings.json
builder.Services.Configure<DeliveryZoneOptions>(
    builder.Configuration.GetSection("DeliveryZone"));

// Registrar HttpClient y servicio de DeliveryZone para geocodificación
builder.Services.AddHttpClient<IDeliveryZoneService, DeliveryZoneService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10); // Timeout de 10 segundos para geocodificación
});

var app = builder.Build();

// Configurar pipeline HTTP
// Swagger solo en desarrollo o si está explícitamente habilitado en configuración
var enableSwagger = app.Configuration.GetValue<bool>("EnableSwagger", false);
if (app.Environment.IsDevelopment() || enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "CornerApp API v1");
        
        // En producción, proteger Swagger con autenticación básica si está habilitado
        if (!app.Environment.IsDevelopment())
        {
            // Opcional: Agregar protección adicional aquí si es necesario
            // Por ejemplo, requerir autenticación para acceder a Swagger
        }
    });
}

// Middleware de Security Headers (debe ir temprano para aplicar a todas las respuestas)
app.UseMiddleware<SecurityHeadersMiddleware>();

// Middleware de transformación de respuestas (debe ir antes de otros middlewares que escriben respuestas)
app.UseMiddleware<ResponseTransformationMiddleware>();

// Middleware de versionado de API (debe ir temprano, antes de routing)
app.UseMiddleware<ApiVersioningMiddleware>();

// Middleware de validación de headers y request (debe ir temprano)
app.UseMiddleware<RequestValidationMiddleware>();

// Middleware de validación de tamaño de request (debe ir muy temprano)
app.UseMiddleware<RequestSizeLimitMiddleware>();

// Middleware de logging de requests/responses (debe ir temprano para capturar todo)
app.UseMiddleware<RequestLoggingMiddleware>();

// Middleware de manejo de errores global (debe ir después del logging)
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Rate Limiting (solo en producción o si está habilitado)
var enableRateLimit = !app.Environment.IsDevelopment() || 
    app.Configuration.GetValue<bool>("IpRateLimiting:EnableEndpointRateLimiting", false);
if (enableRateLimit)
{
    app.UseIpRateLimiting();
}

// CORS debe ir ANTES de UseAuthorization y UseHttpsRedirection
// El middleware de optimización CORS maneja preflight requests de manera eficiente
app.UseMiddleware<CorsOptimizationMiddleware>();
app.UseCors("AllowReactNative");

// Compresión de respuestas (debe ir antes de otros middlewares que escriben respuestas)
app.UseResponseCompression();

// Response Caching (HTTP Cache Headers)
app.UseResponseCaching();

// Prometheus HTTP Metrics (debe ir antes de UseRouting)
var enablePrometheus = builder.Configuration.GetValue<bool>("Metrics:Prometheus:Enabled", true);
if (enablePrometheus)
{
    app.UseHttpMetrics(); // Métricas HTTP automáticas
    Log.Information("Prometheus HTTP metrics habilitado");
}

app.UseRouting();

// Forzar HTTPS en producción
if (!app.Environment.IsDevelopment())
{
app.UseHttpsRedirection();
    
    // Agregar headers de optimización (Security Headers se manejan en SecurityHeadersMiddleware)
    app.Use(async (context, next) =>
    {
        // Request ID ya se agrega en RequestLoggingMiddleware, pero asegurarse de que esté presente
        if (!context.Response.Headers.ContainsKey("X-Request-Id") && context.Items.ContainsKey("RequestId"))
        {
            context.Response.Headers.Append("X-Request-Id", context.Items["RequestId"]?.ToString() ?? string.Empty);
        }
        
        // Vary header para cache correcto con Content Negotiation
        if (!context.Response.Headers.ContainsKey("Vary"))
        {
            context.Response.Headers.Append("Vary", "Accept, Accept-Encoding, Accept-Language");
        }
        
        await next();
    });
}
else
{
    // En desarrollo, permitir HTTP
    app.UseHttpsRedirection();
}

// Configurar archivos estáticos para servir el logo y las imágenes
// Incluir configuración para WebP con Content-Type correcto
var staticFileOptions = new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var path = ctx.File.Name.ToLowerInvariant();
        if (path.EndsWith(".webp"))
        {
            ctx.Context.Response.Headers.Append("Content-Type", "image/webp");
        }
    }
};
app.UseStaticFiles(staticFileOptions);

// Configurar carpeta de imágenes de productos
var imagesPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "images", "products");
if (!Directory.Exists(imagesPath))
{
    Directory.CreateDirectory(imagesPath);
}

app.UseAuthentication(); // Debe ir antes de UseAuthorization
app.UseAuthorization();

// Health Checks endpoints
app.MapHealthChecks("/health", new HealthCheckOptions
{
    Predicate = _ => true,
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse,
    AllowCachingResponses = false
});

// Health check detallado con información de todos los checks
app.MapHealthChecks("/health/detailed", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var result = System.Text.Json.JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            totalDuration = report.TotalDuration.TotalMilliseconds,
            entries = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                description = e.Value.Description,
                duration = e.Value.Duration.TotalMilliseconds,
                data = e.Value.Data,
                tags = e.Value.Tags,
                exception = e.Value.Exception?.Message
            })
        }, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
        await context.Response.WriteAsync(result);
    },
    AllowCachingResponses = false
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse,
    AllowCachingResponses = false
});

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("self"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse,
    AllowCachingResponses = false
});

app.MapControllers();

// SignalR Hub para notificaciones en tiempo real de pedidos
app.MapHub<CornerApp.API.Hubs.OrdersHub>("/hubs/orders");
Log.Information("SignalR Hub habilitado en /hubs/orders");

// Prometheus Metrics Endpoint (debe ir después de MapControllers)
if (enablePrometheus)
{
    app.MapMetrics("/metrics"); // Endpoint de Prometheus
    Log.Information("Prometheus metrics endpoint habilitado en /metrics");
}

// Aplicar migraciones automáticamente al iniciar (solo en desarrollo)
if (app.Environment.IsDevelopment())
{
    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        try
        {
            // Aplicar migraciones existentes
            dbContext.Database.Migrate();
            
            // Aplicar migración de Spaces manualmente si la tabla no existe
            try
            {
                var spacesTableExists = dbContext.Database.ExecuteSqlRaw(@"
                    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Spaces]') AND type in (N'U'))
                    BEGIN
                        CREATE TABLE [dbo].[Spaces] (
                            [Id] int NOT NULL IDENTITY,
                            [Name] nvarchar(100) NOT NULL,
                            [Description] nvarchar(500) NULL,
                            [IsActive] bit NOT NULL DEFAULT 1,
                            [CreatedAt] datetime2 NOT NULL,
                            [UpdatedAt] datetime2 NULL,
                            CONSTRAINT [PK_Spaces] PRIMARY KEY ([Id])
                        );
                        CREATE INDEX [IX_Spaces_Name] ON [dbo].[Spaces] ([Name]);
                        CREATE INDEX [IX_Spaces_IsActive] ON [dbo].[Spaces] ([IsActive]);
                    END
                ");
                
                // Agregar columna SpaceId a Tables si no existe
                var spaceIdColumnExists = dbContext.Database.ExecuteSqlRaw(@"
                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Tables]') AND name = 'SpaceId')
                    BEGIN
                        ALTER TABLE [dbo].[Tables] ADD [SpaceId] int NULL;
                        CREATE INDEX [IX_Tables_SpaceId] ON [dbo].[Tables] ([SpaceId]);
                        ALTER TABLE [dbo].[Tables] ADD CONSTRAINT [FK_Tables_Spaces_SpaceId] 
                        FOREIGN KEY ([SpaceId]) REFERENCES [dbo].[Spaces] ([Id]) ON DELETE SET NULL;
                    END
                ");
                
                // Registrar la migración si no está registrada
                dbContext.Database.ExecuteSqlRaw(@"
                    IF NOT EXISTS (SELECT * FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = '20260106000000_AddSpaces')
                    BEGIN
                        INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
                        VALUES ('20260106000000_AddSpaces', '8.0.0');
                    END
                ");
                
                Log.Information("✅ Migración de Spaces aplicada exitosamente");
            }
            catch (Exception ex)
            {
                // Si la tabla ya existe o hay algún error, solo loguear
                Log.Warning(ex, "Advertencia al aplicar migración de Spaces (puede que ya esté aplicada)");
            }
            
            // Crear admin por defecto si no existe
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
            
            // Crear usuario berni2384@hotmail.com si no existe
            var email = "berni2384@hotmail.com";
            var existingUser = await dbContext.Admins
                .FirstOrDefaultAsync(a => a.Username.ToLower() == email.ToLower() || a.Email.ToLower() == email.ToLower());
            if (existingUser == null)
            {
                var user = new CornerApp.API.Models.Admin
                {
                    Username = email,
                    Email = email,
                    Name = "Berni",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("berni1"),
                    CreatedAt = DateTime.UtcNow
                };
                dbContext.Admins.Add(user);
                await dbContext.SaveChangesAsync();
                Log.Information("✅ Usuario creado: {Email}", email);
            }
            else
            {
                // Actualizar contraseña si el usuario ya existe
                existingUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword("berni1");
                existingUser.UpdatedAt = DateTime.UtcNow;
                await dbContext.SaveChangesAsync();
                Log.Information("✅ Contraseña actualizada para usuario: {Email}", email);
            }
            
            // Crear repartidor Diego si no existe
            var deliveryEmail = "diego@gmail.com";
            var existingDeliveryPerson = await dbContext.DeliveryPersons
                .FirstOrDefaultAsync(d => (d.Username != null && d.Username.ToLower() == deliveryEmail.ToLower()) || 
                                         (d.Email != null && d.Email.ToLower() == deliveryEmail.ToLower()));
            if (existingDeliveryPerson == null)
            {
                var deliveryPerson = new CornerApp.API.Models.DeliveryPerson
                {
                    Name = "Diego",
                    Username = deliveryEmail.ToLower(),
                    Email = deliveryEmail.ToLower(),
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                dbContext.DeliveryPersons.Add(deliveryPerson);
                await dbContext.SaveChangesAsync();
                Log.Information("✅ Repartidor creado: {Email} - Usuario: {Username}, Contraseña: admin123", deliveryEmail, deliveryEmail);
            }
            else
            {
                // Actualizar contraseña si el repartidor ya existe
                existingDeliveryPerson.PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123");
                existingDeliveryPerson.UpdatedAt = DateTime.UtcNow;
                await dbContext.SaveChangesAsync();
                Log.Information("✅ Contraseña actualizada para repartidor: {Email}", deliveryEmail);
            }
        }
        catch (Exception ex)
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
            logger.LogError(ex, "Error al aplicar migraciones o crear admin");
        }
    }
}

app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Aplicación terminada inesperadamente");
}
finally
{
    Log.CloseAndFlush();
}

