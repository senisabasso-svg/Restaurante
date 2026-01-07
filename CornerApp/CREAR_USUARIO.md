# Crear Usuario Admin

## Opción 1: Usar el Endpoint HTTP (Recomendado)

1. **Reinicia el backend** para que cargue el nuevo endpoint:
   - Detén el backend (Ctrl+C en la ventana)
   - Vuelve a ejecutar: `dotnet run`

2. **Ejecuta esta petición HTTP:**

```powershell
$body = @{
    Email = "berni2384@hotmail.com"
    Password = "berni1"
    Name = "Berni"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/auth/admin/create-user" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"
```

O usando curl:
```bash
curl -X POST http://localhost:5000/api/auth/admin/create-user \
  -H "Content-Type: application/json" \
  -d '{"Email":"berni2384@hotmail.com","Password":"berni1","Name":"Berni"}'
```

O desde el navegador/postman:
- URL: `http://localhost:5000/api/auth/admin/create-user`
- Method: POST
- Body (JSON):
```json
{
  "Email": "berni2384@hotmail.com",
  "Password": "berni1",
  "Name": "Berni"
}
```

## Opción 2: Usar SQL Directo

Si prefieres usar SQL, primero necesitas generar el hash de BCrypt. Ejecuta este script C#:

```csharp
using BCrypt.Net;
var hash = BCrypt.Net.BCrypt.HashPassword("berni1");
Console.WriteLine(hash);
```

Luego usa ese hash en el INSERT:
```sql
INSERT INTO Admins (Username, Email, Name, PasswordHash, CreatedAt)
VALUES (
    'berni2384@hotmail.com',
    'berni2384@hotmail.com',
    'Berni',
    '<HASH_GENERADO>',
    GETUTCDATE()
)
```

## Credenciales

- **Username/Email**: berni2384@hotmail.com
- **Password**: berni1
- **Name**: Berni

## Login

Después de crear el usuario, puedes hacer login en:
- `POST http://localhost:5000/api/auth/admin/login`
- Body: `{ "Username": "berni2384@hotmail.com", "Password": "berni1" }`

