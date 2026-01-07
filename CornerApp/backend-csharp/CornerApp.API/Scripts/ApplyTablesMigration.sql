-- Script SQL para crear la tabla Tables y agregar la columna TableId a Orders
-- Ejecutar este script en SQL Server Management Studio o con sqlcmd

-- Crear tabla Tables
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Tables]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Tables] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [Number] nvarchar(50) NOT NULL,
        [Capacity] int NOT NULL DEFAULT 4,
        [Location] nvarchar(100) NULL,
        [Status] nvarchar(50) NOT NULL DEFAULT 'Available',
        [IsActive] bit NOT NULL DEFAULT 1,
        [Notes] nvarchar(500) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_Tables] PRIMARY KEY ([Id])
    );

    -- Crear índices
    CREATE INDEX [IX_Tables_Number] ON [dbo].[Tables] ([Number]);
    CREATE INDEX [IX_Tables_Status] ON [dbo].[Tables] ([Status]);
    CREATE INDEX [IX_Tables_IsActive] ON [dbo].[Tables] ([IsActive]);
    CREATE INDEX [IX_Tables_IsActive_Status] ON [dbo].[Tables] ([IsActive], [Status]);

    PRINT 'Tabla Tables creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla Tables ya existe';
END

-- Agregar columna TableId a Orders si no existe
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = 'TableId')
BEGIN
    ALTER TABLE [dbo].[Orders]
    ADD [TableId] int NULL;

    CREATE INDEX [IX_Orders_TableId] ON [dbo].[Orders] ([TableId]);

    ALTER TABLE [dbo].[Orders]
    ADD CONSTRAINT [FK_Orders_Tables_TableId] 
    FOREIGN KEY ([TableId]) REFERENCES [dbo].[Tables] ([Id]) ON DELETE SET NULL;

    PRINT 'Columna TableId agregada a Orders exitosamente';
END
ELSE
BEGIN
    PRINT 'La columna TableId ya existe en Orders';
END

PRINT 'Migración completada';

