-- Script para crear la tabla SubProducts
-- Ejecutar este script en SQL Server Management Studio o en la base de datos

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SubProducts]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[SubProducts] (
        [Id] int NOT NULL IDENTITY(1,1),
        [Name] nvarchar(200) NOT NULL,
        [Description] nvarchar(500) NULL,
        [Price] decimal(18,2) NOT NULL,
        [IsAvailable] bit NOT NULL DEFAULT 1,
        [DisplayOrder] int NOT NULL DEFAULT 0,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        [ProductId] int NOT NULL,
        CONSTRAINT [PK_SubProducts] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_SubProducts_Products_ProductId] FOREIGN KEY ([ProductId]) 
            REFERENCES [dbo].[Products] ([Id]) ON DELETE CASCADE
    );
    
    CREATE INDEX [IX_SubProducts_ProductId] ON [dbo].[SubProducts] ([ProductId]);
    CREATE INDEX [IX_SubProducts_IsAvailable] ON [dbo].[SubProducts] ([IsAvailable]);
    CREATE INDEX [IX_SubProducts_DisplayOrder] ON [dbo].[SubProducts] ([DisplayOrder]);
    CREATE INDEX [IX_SubProducts_ProductId_IsAvailable_DisplayOrder] ON [dbo].[SubProducts] ([ProductId], [IsAvailable], [DisplayOrder]);
    
    PRINT 'Tabla SubProducts creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla SubProducts ya existe';
END

