using Microsoft.Extensions.Configuration;

namespace CornerApp.API.Middleware;

/// <summary>
/// Middleware para agregar headers de seguridad HTTP
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SecurityHeadersMiddleware> _logger;
    private readonly SecurityHeadersOptions _options;

    public SecurityHeadersMiddleware(
        RequestDelegate next,
        ILogger<SecurityHeadersMiddleware> logger,
        IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _options = new SecurityHeadersOptions();
        configuration.GetSection("SecurityHeaders").Bind(_options);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // X-Content-Type-Options: Previene MIME type sniffing
        if (_options.EnableXContentTypeOptions)
        {
            context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
        }

        // X-Frame-Options: Previene clickjacking
        if (_options.EnableXFrameOptions)
        {
            context.Response.Headers.Append("X-Frame-Options", _options.XFrameOptionsValue);
        }

        // X-XSS-Protection: Protección XSS (legacy, pero útil para navegadores antiguos)
        if (_options.EnableXXssProtection)
        {
            context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
        }

        // Referrer-Policy: Controla qué información del referrer se envía
        if (_options.EnableReferrerPolicy)
        {
            context.Response.Headers.Append("Referrer-Policy", _options.ReferrerPolicyValue);
        }

        // Permissions-Policy (anteriormente Feature-Policy): Controla qué features del navegador están disponibles
        if (_options.EnablePermissionsPolicy)
        {
            context.Response.Headers.Append("Permissions-Policy", _options.PermissionsPolicyValue);
        }

        // Strict-Transport-Security (HSTS): Fuerza HTTPS
        if (_options.EnableStrictTransportSecurity && context.Request.IsHttps)
        {
            var hstsValue = $"max-age={_options.HstsMaxAgeSeconds}";
            if (_options.HstsIncludeSubDomains)
            {
                hstsValue += "; includeSubDomains";
            }
            if (_options.HstsPreload)
            {
                hstsValue += "; preload";
            }
            context.Response.Headers.Append("Strict-Transport-Security", hstsValue);
        }

        // Content-Security-Policy: Controla qué recursos puede cargar la página
        if (_options.EnableContentSecurityPolicy && !string.IsNullOrEmpty(_options.ContentSecurityPolicyValue))
        {
            context.Response.Headers.Append("Content-Security-Policy", _options.ContentSecurityPolicyValue);
        }

        // X-Permitted-Cross-Domain-Policies: Controla políticas cross-domain
        if (_options.EnableXPermittedCrossDomainPolicies)
        {
            context.Response.Headers.Append("X-Permitted-Cross-Domain-Policies", _options.XPermittedCrossDomainPoliciesValue);
        }

        // Expect-CT: Certificate Transparency (deprecated pero algunos navegadores aún lo usan)
        if (_options.EnableExpectCT)
        {
            var expectCtValue = $"max-age={_options.ExpectCTMaxAgeSeconds}";
            if (!string.IsNullOrEmpty(_options.ExpectCTReportUri))
            {
                expectCtValue += $", report-uri=\"{_options.ExpectCTReportUri}\"";
            }
            context.Response.Headers.Append("Expect-CT", expectCtValue);
        }

        await _next(context);
    }
}

/// <summary>
/// Opciones de configuración para Security Headers
/// </summary>
public class SecurityHeadersOptions
{
    public bool EnableXContentTypeOptions { get; set; } = true;
    public bool EnableXFrameOptions { get; set; } = true;
    public string XFrameOptionsValue { get; set; } = "DENY"; // DENY, SAMEORIGIN, ALLOW-FROM uri
    public bool EnableXXssProtection { get; set; } = true;
    public bool EnableReferrerPolicy { get; set; } = true;
    public string ReferrerPolicyValue { get; set; } = "strict-origin-when-cross-origin";
    public bool EnablePermissionsPolicy { get; set; } = true;
    public string PermissionsPolicyValue { get; set; } = "geolocation=(), microphone=(), camera=()";
    public bool EnableStrictTransportSecurity { get; set; } = true;
    public int HstsMaxAgeSeconds { get; set; } = 31536000; // 1 año
    public bool HstsIncludeSubDomains { get; set; } = true;
    public bool HstsPreload { get; set; } = false;
    public bool EnableContentSecurityPolicy { get; set; } = false; // Deshabilitado por defecto (requiere configuración cuidadosa)
    public string ContentSecurityPolicyValue { get; set; } = string.Empty;
    public bool EnableXPermittedCrossDomainPolicies { get; set; } = true;
    public string XPermittedCrossDomainPoliciesValue { get; set; } = "none";
    public bool EnableExpectCT { get; set; } = false; // Deprecated pero algunos navegadores lo usan
    public int ExpectCTMaxAgeSeconds { get; set; } = 86400; // 1 día
    public string ExpectCTReportUri { get; set; } = string.Empty;
}
