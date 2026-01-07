# Security Headers

## Descripción

Este documento describe los Security Headers implementados en CornerApp API para mejorar la seguridad de las respuestas HTTP.

## Headers Implementados

### 1. X-Content-Type-Options: nosniff

**Propósito**: Previene que el navegador intente adivinar el tipo MIME de un recurso (MIME type sniffing).

**Valor**: `nosniff`

**Beneficio**: Protege contra ataques donde un archivo malicioso se hace pasar por otro tipo de archivo.

**Ejemplo**:
```
X-Content-Type-Options: nosniff
```

### 2. X-Frame-Options

**Propósito**: Previene que la página sea cargada en un iframe (protección contra clickjacking).

**Valores posibles**:
- `DENY`: No permite cargar en ningún iframe
- `SAMEORIGIN`: Solo permite cargar en iframes del mismo origen
- `ALLOW-FROM uri`: Permite cargar solo desde un URI específico (deprecated)

**Valor por defecto**: `DENY`

**Beneficio**: Protege contra ataques de clickjacking donde un atacante superpone contenido malicioso sobre tu sitio.

**Ejemplo**:
```
X-Frame-Options: DENY
```

### 3. X-XSS-Protection

**Propósito**: Habilita la protección XSS del navegador (legacy, pero útil para navegadores antiguos).

**Valor**: `1; mode=block`

**Beneficio**: Proporciona una capa adicional de protección contra XSS en navegadores que lo soportan.

**Nota**: Este header está deprecated en navegadores modernos que usan Content Security Policy, pero se mantiene para compatibilidad.

**Ejemplo**:
```
X-XSS-Protection: 1; mode=block
```

### 4. Referrer-Policy

**Propósito**: Controla qué información del referrer se envía con las requests.

**Valores comunes**:
- `no-referrer`: No envía información del referrer
- `strict-origin-when-cross-origin`: Envía origen completo para same-origin, solo origen para cross-origin HTTPS→HTTPS, nada para downgrade
- `same-origin`: Solo envía referrer para same-origin requests
- `origin`: Solo envía el origen, no la URL completa

**Valor por defecto**: `strict-origin-when-cross-origin`

**Beneficio**: Protege la privacidad de los usuarios al controlar qué información se comparte.

**Ejemplo**:
```
Referrer-Policy: strict-origin-when-cross-origin
```

### 5. Permissions-Policy (anteriormente Feature-Policy)

**Propósito**: Controla qué features del navegador están disponibles para la página.

**Valor por defecto**: `geolocation=(), microphone=(), camera=()`

**Beneficio**: Previene que sitios maliciosos accedan a features sensibles del navegador sin permiso explícito.

**Ejemplo**:
```
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### 6. Strict-Transport-Security (HSTS)

**Propósito**: Fuerza al navegador a usar HTTPS para todas las comunicaciones futuras con el dominio.

**Parámetros**:
- `max-age`: Tiempo en segundos que el navegador debe recordar usar HTTPS
- `includeSubDomains`: Aplica HSTS a todos los subdominios
- `preload`: Indica que el dominio puede ser incluido en la lista de preload de HSTS

**Valor por defecto**: `max-age=31536000; includeSubDomains` (1 año)

**Beneficio**: Previene ataques de downgrade a HTTP y protege contra man-in-the-middle.

**Nota**: Solo se aplica en requests HTTPS.

**Ejemplo**:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### 7. Content-Security-Policy (CSP)

**Propósito**: Controla qué recursos puede cargar la página (scripts, estilos, imágenes, etc.).

**Valor**: Configurable (deshabilitado por defecto)

**Beneficio**: Previene XSS, clickjacking, y otros ataques de inyección.

**Nota**: Requiere configuración cuidadosa para no romper funcionalidad legítima. Se recomienda implementar gradualmente.

**Ejemplo básico**:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
```

### 8. X-Permitted-Cross-Domain-Policies

**Propósito**: Controla políticas cross-domain para Adobe Flash y PDFs.

**Valores**:
- `none`: No permite políticas cross-domain
- `master-only`: Solo permite políticas del archivo master
- `by-content-type`: Solo permite políticas para tipos de contenido específicos
- `all`: Permite todas las políticas

**Valor por defecto**: `none`

**Beneficio**: Previene que archivos Flash o PDF maliciosos se ejecuten desde otros dominios.

**Ejemplo**:
```
X-Permitted-Cross-Domain-Policies: none
```

### 9. Expect-CT

**Propósito**: Certificate Transparency (deprecated pero algunos navegadores aún lo usan).

**Parámetros**:
- `max-age`: Tiempo en segundos
- `report-uri`: URI para reportar violaciones

**Valor por defecto**: Deshabilitado (deprecated)

**Nota**: Este header está deprecated en favor de Certificate Transparency en DNS (CT-over-DNS).

## Configuración

### appsettings.json

```json
{
  "SecurityHeaders": {
    "EnableXContentTypeOptions": true,
    "EnableXFrameOptions": true,
    "XFrameOptionsValue": "DENY",
    "EnableXXssProtection": true,
    "EnableReferrerPolicy": true,
    "ReferrerPolicyValue": "strict-origin-when-cross-origin",
    "EnablePermissionsPolicy": true,
    "PermissionsPolicyValue": "geolocation=(), microphone=(), camera=()",
    "EnableStrictTransportSecurity": true,
    "HstsMaxAgeSeconds": 31536000,
    "HstsIncludeSubDomains": true,
    "HstsPreload": false,
    "EnableContentSecurityPolicy": false,
    "ContentSecurityPolicyValue": "",
    "EnableXPermittedCrossDomainPolicies": true,
    "XPermittedCrossDomainPoliciesValue": "none",
    "EnableExpectCT": false,
    "ExpectCTMaxAgeSeconds": 86400,
    "ExpectCTReportUri": ""
  }
}
```

### Variables de Entorno

Puedes sobrescribir cualquier configuración usando variables de entorno con el formato:
```
SecurityHeaders__EnableXContentTypeOptions=true
SecurityHeaders__HstsMaxAgeSeconds=31536000
```

## Verificación

### Usando curl

```bash
curl -I https://tu-api.com/api/products
```

Deberías ver headers como:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Permitted-Cross-Domain-Policies: none
```

### Usando herramientas online

- [SecurityHeaders.com](https://securityheaders.com/)
- [Mozilla Observatory](https://observatory.mozilla.org/)

## Mejores Prácticas

1. **HSTS**: Solo habilitar en producción con HTTPS configurado correctamente
2. **CSP**: Implementar gradualmente, probando en desarrollo primero
3. **X-Frame-Options**: Usar `SAMEORIGIN` si necesitas iframes del mismo origen
4. **Referrer-Policy**: Ajustar según necesidades de privacidad y analytics
5. **Permissions-Policy**: Restringir solo las features que no necesitas

## Troubleshooting

### CSP bloquea recursos legítimos

- Revisar la consola del navegador para ver qué recursos están siendo bloqueados
- Ajustar la política CSP para permitir recursos necesarios
- Usar `report-uri` o `report-to` para recibir reportes de violaciones

### HSTS causa problemas en desarrollo

- Deshabilitar HSTS en desarrollo (`EnableStrictTransportSecurity: false`)
- O usar `max-age=0` para desarrollo local

### X-Frame-Options bloquea iframes necesarios

- Cambiar a `SAMEORIGIN` si necesitas iframes del mismo origen
- O usar CSP `frame-ancestors` en lugar de X-Frame-Options (más flexible)

## Referencias

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Security Headers Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
