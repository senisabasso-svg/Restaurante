-- Script para aplicar la migración de Spaces manualmente
-- Ejecutar este script en SQL Server Management Studio o en la base de datos

-- Crear tabla Spaces
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
    
    -- Crear índices
    CREATE INDEX [IX_Spaces_Name] ON [dbo].[Spaces] ([Name]);
    CREATE INDEX [IX_Spaces_IsActive] ON [dbo].[Spaces] ([IsActive]);
    
    PRINT 'Tabla Spaces creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla Spaces ya existe';
END
GO

-- Agregar columna SpaceId a la tabla Tables si no existe
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Tables]') AND name = 'SpaceId')
BEGIN
    ALTER TABLE [dbo].[Tables]
    ADD [SpaceId] int NULL;
    
    -- Crear índice
    CREATE INDEX [IX_Tables_SpaceId] ON [dbo].[Tables] ([SpaceId]);
    
    -- Crear foreign key
    ALTER TABLE [dbo].[Tables]
    ADD CONSTRAINT [FK_Tables_Spaces_SpaceId] 
    FOREIGN KEY ([SpaceId]) 
    REFERENCES [dbo].[Spaces] ([Id]) 
    ON DELETE SET NULL;
    
    PRINT 'Columna SpaceId agregada a la tabla Tables exitosamente';
END
ELSE
BEGIN
    PRINT 'La columna SpaceId ya existe en la tabla Tables';
END
GO

-- Registrar la migración en la tabla __EFMigrationsHistory
IF NOT EXISTS (SELECT * FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = '20260106000000_AddSpaces')
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES ('20260106000000_AddSpaces', '8.0.0');
    
    PRINT 'Migración registrada en __EFMigrationsHistory';
END
ELSE
BEGIN
    PRINT 'La migración ya está registrada';
END
GO

PRINT 'Migración de Spaces aplicada exitosamente';

