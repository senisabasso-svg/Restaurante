# Persistencia de Sesión - Explicación

## ¿Por qué aparece logueado automáticamente?

Cuando abres la app Expo en tu celular y ya apareces logueado, esto es **comportamiento normal y esperado**. La aplicación implementa "persistencia de sesión" para mejorar la experiencia del usuario.

## Cómo Funciona

### Flujo de Inicio de Sesión

1. **Primera vez**: El usuario ingresa email/contraseña → Backend valida → Devuelve token JWT → App guarda token en AsyncStorage
2. **Siguientes veces**: Al abrir la app → Lee token de AsyncStorage → Verifica con backend → Si es válido, restaura sesión automáticamente

### Código Relevante

```javascript
// App.js - Al iniciar la app
useEffect(() => {
  dispatch(initializeCart());
  dispatch(checkAuth()); // ← Verifica si hay sesión guardada
}, [dispatch]);
```

```javascript
// authSlice.js - Verificación de token
export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    // 1. Lee token guardado
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    
    // 2. Si no hay token, retorna null (no autenticado)
    if (!token) return null;
    
    // 3. Verifica token con el backend
    const user = await verifyToken(token);
    
    // 4. Si es válido, restaura sesión
    return { token, user, role };
    
    // 5. Si es inválido, limpia storage automáticamente
  }
);
```

## Seguridad

### ✅ Lo que está bien

- **Verifica con backend**: No solo confía en el token local, lo valida con el servidor
- **Limpia automáticamente**: Si el token expiró o es inválido, elimina la sesión
- **Mejora UX**: El usuario no tiene que loguearse cada vez

### ⚠️ Mejoras Necesarias

1. **AsyncStorage → SecureStore**: Los tokens deberían estar encriptados
2. **Expiración**: Los tokens actuales duran 30 días (demasiado tiempo)
3. **Refresh Tokens**: Implementar renovación automática de tokens

## Cuándo se Cierra la Sesión

La sesión se cierra automáticamente cuando:

1. **Token expirado**: El backend rechaza el token (después de 30 días)
2. **Token inválido**: El backend no reconoce el token
3. **Logout manual**: El usuario presiona "Cerrar Sesión"
4. **Error de conexión**: Si no puede verificar con el backend (pero mantiene el token local)

## Cómo Cerrar Sesión Manualmente

El usuario puede cerrar sesión desde:
- Menú de perfil → "Cerrar Sesión"
- Esto ejecuta `logoutUser()` que limpia AsyncStorage

## Mejoras Recomendadas

Ver el plan de seguridad completo en `docs/PLAN_SEGURIDAD.md`:

1. **Fase 1.3**: Implementar SecureStore para tokens
2. **Fase 2.1**: Reducir expiración y agregar refresh tokens

---

**Conclusión**: El comportamiento es correcto y seguro, pero se puede mejorar usando SecureStore en lugar de AsyncStorage.

