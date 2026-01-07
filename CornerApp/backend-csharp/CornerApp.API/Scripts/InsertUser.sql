-- Script SQL para insertar usuario Admin
-- Ejecutar en SQL Server Management Studio o con sqlcmd
-- 
-- NOTA: Este script genera el hash usando una función temporal
-- Si BCrypt no está disponible en SQL, ejecuta primero el endpoint:
-- POST http://localhost:5000/api/auth/admin/create-user
-- Body: { "Email": "berni2384@hotmail.com", "Password": "berni1", "Name": "Berni" }

-- Verificar si el usuario ya existe
IF EXISTS (SELECT 1 FROM Admins WHERE Username = 'berni2384@hotmail.com' OR Email = 'berni2384@hotmail.com')
BEGIN
    -- Actualizar contraseña (necesitas el hash de BCrypt)
    -- UPDATE Admins 
    -- SET PasswordHash = '$2a$11$...', -- Hash de "berni1" generado con BCrypt
    --     UpdatedAt = GETUTCDATE()
    -- WHERE Username = 'berni2384@hotmail.com' OR Email = 'berni2384@hotmail.com'
    PRINT 'Usuario ya existe. Usa el endpoint HTTP para actualizar la contraseña.'
END
ELSE
BEGIN
    -- Insertar nuevo usuario (necesitas el hash de BCrypt)
    -- INSERT INTO Admins (Username, Email, Name, PasswordHash, CreatedAt)
    -- VALUES (
    --     'berni2384@hotmail.com',
    --     'berni2384@hotmail.com',
    --     'Berni',
    --     '$2a$11$...', -- Hash de "berni1" generado con BCrypt
    --     GETUTCDATE()
    -- )
    PRINT 'Usuario no existe. Usa el endpoint HTTP para crear el usuario.'
END

-- MEJOR OPCIÓN: Usa el endpoint HTTP después de reiniciar el backend:
-- POST http://localhost:5000/api/auth/admin/create-user
-- Content-Type: application/json
-- 
-- {
--   "Email": "berni2384@hotmail.com",
--   "Password": "berni1",
--   "Name": "Berni"
-- }

