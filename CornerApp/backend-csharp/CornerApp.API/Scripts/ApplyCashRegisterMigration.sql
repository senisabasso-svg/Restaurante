-- Script SQL para aplicar la migración AddCashRegister manualmente
-- Ejecutar este script en la base de datos si no se puede usar dotnet ef

-- Crear tabla CashRegisters
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CashRegisters]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[CashRegisters] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [OpenedAt] datetime2 NOT NULL,
        [ClosedAt] datetime2 NULL,
        [InitialAmount] decimal(18,2) NOT NULL,
        [FinalAmount] decimal(18,2) NULL,
        [TotalSales] decimal(18,2) NOT NULL DEFAULT 0,
        [TotalCash] decimal(18,2) NOT NULL DEFAULT 0,
        [TotalPOS] decimal(18,2) NOT NULL DEFAULT 0,
        [TotalTransfer] decimal(18,2) NOT NULL DEFAULT 0,
        [IsOpen] bit NOT NULL,
        [CreatedBy] nvarchar(200) NULL,
        [ClosedBy] nvarchar(200) NULL,
        [Notes] nvarchar(1000) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_CashRegisters] PRIMARY KEY ([Id])
    );
    
    -- Crear índices
    CREATE INDEX [IX_CashRegisters_IsOpen] ON [dbo].[CashRegisters] ([IsOpen]);
    CREATE INDEX [IX_CashRegisters_OpenedAt] ON [dbo].[CashRegisters] ([OpenedAt]);
    CREATE INDEX [IX_CashRegisters_ClosedAt] ON [dbo].[CashRegisters] ([ClosedAt]);
    CREATE INDEX [IX_CashRegisters_IsOpen_OpenedAt] ON [dbo].[CashRegisters] ([IsOpen], [OpenedAt]);
    
    PRINT 'Tabla CashRegisters creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla CashRegisters ya existe';
END

-- Registrar la migración en la tabla __EFMigrationsHistory
IF NOT EXISTS (SELECT * FROM [__EFMigrationsHistory] WHERE [MigrationId] = '20260112133054_AddCashRegister')
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES ('20260112133054_AddCashRegister', '8.0.0');
    PRINT 'Migración registrada en __EFMigrationsHistory';
END
ELSE
BEGIN
    PRINT 'La migración ya está registrada';
END
