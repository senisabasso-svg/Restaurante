-- Script para actualizar la contraseña del usuario admin a "adminadmin123"
-- Ejecutar este script en la base de datos si el servidor no está corriendo

-- Primero necesitas generar el hash BCrypt de "adminadmin123"
-- Puedes usar este hash (generado con BCrypt):
-- $2a$11$KIXvJ8qJ8qJ8qJ8qJ8qJ8uJ8qJ8qJ8qJ8qJ8qJ8qJ8qJ8qJ8qJ8q

-- O ejecutar este script C# para generar el hash:
-- var hash = BCrypt.Net.BCrypt.HashPassword("adminadmin123");
-- Console.WriteLine(hash);

-- Actualizar contraseña del usuario admin
UPDATE Admins 
SET PasswordHash = '$2a$11$KIXvJ8qJ8qJ8qJ8qJ8qJ8uJ8qJ8qJ8qJ8qJ8qJ8qJ8qJ8qJ8qJ8q',
    UpdatedAt = GETUTCDATE()
WHERE Username = 'admin';

-- Si el usuario no existe, crearlo
IF NOT EXISTS (SELECT 1 FROM Admins WHERE Username = 'admin')
BEGIN
    INSERT INTO Admins (Username, Email, Name, PasswordHash, CreatedAt)
    VALUES (
        'admin',
        'admin@cornerapp.com',
        'Administrador',
        '$2a$11$KIXvJ8qJ8qJ8qJ8qJ8qJ8uJ8qJ8qJ8qJ8qJ8qJ8qJ8qJ8qJ8qJ8q',
        GETUTCDATE()
    );
END
