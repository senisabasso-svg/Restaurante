-- Migración: AddPOSTransactionFieldsToOrder
-- Fecha: 2026-01-15
-- Descripción: Agrega campos para almacenar información de transacciones POS en la tabla Orders

-- Verificar si las columnas ya existen antes de agregarlas
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = 'POSTransactionId')
BEGIN
    ALTER TABLE [dbo].[Orders]
    ADD [POSTransactionId] bigint NULL;
    PRINT 'Columna POSTransactionId agregada exitosamente';
END
ELSE
BEGIN
    PRINT 'Columna POSTransactionId ya existe';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = 'POSTransactionIdString')
BEGIN
    ALTER TABLE [dbo].[Orders]
    ADD [POSTransactionIdString] nvarchar(max) NULL;
    PRINT 'Columna POSTransactionIdString agregada exitosamente';
END
ELSE
BEGIN
    PRINT 'Columna POSTransactionIdString ya existe';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = 'POSTransactionDateTime')
BEGIN
    ALTER TABLE [dbo].[Orders]
    ADD [POSTransactionDateTime] nvarchar(max) NULL;
    PRINT 'Columna POSTransactionDateTime agregada exitosamente';
END
ELSE
BEGIN
    PRINT 'Columna POSTransactionDateTime ya existe';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = 'POSResponse')
BEGIN
    ALTER TABLE [dbo].[Orders]
    ADD [POSResponse] nvarchar(max) NULL;
    PRINT 'Columna POSResponse agregada exitosamente';
END
ELSE
BEGIN
    PRINT 'Columna POSResponse ya existe';
END
GO

PRINT 'Migración completada exitosamente';
