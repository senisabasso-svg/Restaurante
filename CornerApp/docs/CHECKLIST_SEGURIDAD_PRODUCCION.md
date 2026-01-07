# Checklist de Seguridad para Producción

Este checklist debe completarse antes de desplegar a producción.

## Pre-Despliegue

### Backend

#### Configuración
- [ ] `appsettings.Production.json` configurado con valores reales
- [ ] Variables de entorno configuradas en el servidor
- [ ] `JWT_SECRET_KEY` configurado (mínimo 32 caracteres)
- [ ] Connection string de base de datos configurado
- [ ] CORS configurado con orígenes reales (no localhost)
- [ ] Swagger deshabilitado en producción

#### Seguridad
- [ ] HTTPS habilitado y funcionando
- [ ] Rate limiting habilitado
- [ ] Security headers configurados
- [ ] Admin por defecto NO se crea en producción
- [ ] Logging de datos sensibles deshabilitado
- [ ] Validación de entrada implementada

#### Base de Datos
- [ ] Migraciones aplicadas
- [ ] Usuario de BD con permisos mínimos
- [ ] Backups configurados
- [ ] Encriptación en tránsito habilitada

#### Monitoreo
- [ ] Health checks configurados
- [ ] Logging centralizado configurado
- [ ] Alertas configuradas

### Aplicación Móvil

#### Configuración
- [ ] `EXPO_PUBLIC_API_URL` configurada con URL de producción
- [ ] `app.json` configurado correctamente
- [ ] Permisos de ubicación justificados

#### Seguridad
- [ ] SecureStore implementado para tokens
- [ ] Refresh tokens implementados
- [ ] Logs de datos sensibles eliminados
- [ ] SSL pinning implementado (opcional pero recomendado)

#### Build
- [ ] Build de producción probado
- [ ] Versión actualizada en `app.json`
- [ ] Certificados de firma configurados (iOS/Android)

## Post-Despliegue

### Verificación
- [ ] CORS funciona solo con orígenes permitidos
- [ ] Autenticación JWT funciona correctamente
- [ ] Refresh tokens funcionan
- [ ] Rate limiting funciona
- [ ] Health checks responden correctamente
- [ ] Logs no contienen datos sensibles
- [ ] HTTPS funciona en todos los endpoints

### Testing de Seguridad
- [ ] Intentar acceso con origen no permitido (debe fallar)
- [ ] Intentar acceso sin token (debe fallar)
- [ ] Intentar acceso con token expirado (debe refrescar)
- [ ] Intentar rate limiting (debe bloquear después del límite)
- [ ] Verificar que no se expongan stack traces en errores

## Mantenimiento Continuo

### Mensual
- [ ] Revisar logs de seguridad
- [ ] Revisar intentos de acceso fallidos
- [ ] Verificar que no haya vulnerabilidades en dependencias
- [ ] Revisar configuración de CORS

### Trimestral
- [ ] Rotar JWT_SECRET_KEY
- [ ] Revisar y actualizar políticas de seguridad
- [ ] Auditoría de permisos de usuarios
- [ ] Revisar y actualizar documentación de seguridad

### Anual
- [ ] Auditoría de seguridad completa
- [ ] Penetration testing
- [ ] Revisión de políticas de seguridad
- [ ] Actualización de dependencias críticas

## Contactos de Emergencia

En caso de incidente de seguridad:

1. **Responsable de Seguridad**: [Nombre] - [Email] - [Teléfono]
2. **DevOps**: [Nombre] - [Email] - [Teléfono]
3. **Desarrollador Líder**: [Nombre] - [Email] - [Teléfono]

## Procedimiento de Incidente

1. Identificar y aislar el incidente
2. Notificar al equipo de seguridad
3. Documentar el incidente
4. Aplicar parches/correcciones
5. Verificar que el problema esté resuelto
6. Post-mortem y actualización de procedimientos

---

**Última revisión**: [Fecha]
**Próxima revisión**: [Fecha + 3 meses]
**Responsable**: [Nombre]

