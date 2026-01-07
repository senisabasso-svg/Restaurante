-- Agregar columnas PositionX y PositionY a la tabla Tables
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Tables]') AND name = 'PositionX')
BEGIN
    ALTER TABLE [dbo].[Tables]
    ADD [PositionX] float NULL;
    PRINT 'Columna PositionX agregada a Tables';
END
ELSE
BEGIN
    PRINT 'La columna PositionX ya existe';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Tables]') AND name = 'PositionY')
BEGIN
    ALTER TABLE [dbo].[Tables]
    ADD [PositionY] float NULL;
    PRINT 'Columna PositionY agregada a Tables';
END
ELSE
BEGIN
    PRINT 'La columna PositionY ya existe';
END

PRINT 'Migración de posiciones completada';

