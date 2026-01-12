-- Script para agregar el campo Role a la tabla Admins
-- Ejecutar este script en la base de datos

-- Agregar columna Role si no existe
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Admins]') AND name = 'Role')
BEGIN
    -- Primero agregar la columna como nullable
    ALTER TABLE [dbo].[Admins] 
    ADD [Role] NVARCHAR(50) NULL;
    
    PRINT 'Columna Role agregada (nullable)';
    
    -- Asignar valor por defecto 'Employee' a todos los usuarios existentes
    UPDATE [dbo].[Admins] 
    SET [Role] = 'Employee'
    WHERE [Role] IS NULL;
    
    PRINT 'Valores por defecto asignados';
    
    -- Actualizar usuarios específicos a Admin
    UPDATE [dbo].[Admins] 
    SET [Role] = 'Admin' 
    WHERE [Username] = 'admin' OR [Username] = 'berni2384@hotmail.com';
    
    PRINT 'Usuarios admin actualizados';
    
    -- Ahora hacer la columna NOT NULL con default
    ALTER TABLE [dbo].[Admins]
    ALTER COLUMN [Role] NVARCHAR(50) NOT NULL;
    
    PRINT 'Columna Role configurada como NOT NULL';
    
    -- Agregar constraint de default si no existe
    IF NOT EXISTS (SELECT * FROM sys.default_constraints WHERE name = 'DF_Admins_Role')
    BEGIN
        ALTER TABLE [dbo].[Admins]
        ADD CONSTRAINT DF_Admins_Role DEFAULT 'Employee' FOR [Role];
        PRINT 'Constraint DEFAULT agregado';
    END
    
    PRINT 'Campo Role agregado exitosamente a la tabla Admins';
END
ELSE
BEGIN
    PRINT 'El campo Role ya existe en la tabla Admins';
END

-- Crear índice para optimizar consultas por rol
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Admins_Role' AND object_id = OBJECT_ID(N'[dbo].[Admins]'))
BEGIN
    CREATE INDEX [IX_Admins_Role] ON [dbo].[Admins]([Role]);
    PRINT 'Índice IX_Admins_Role creado exitosamente';
END
ELSE
BEGIN
    PRINT 'El índice IX_Admins_Role ya existe';
END
