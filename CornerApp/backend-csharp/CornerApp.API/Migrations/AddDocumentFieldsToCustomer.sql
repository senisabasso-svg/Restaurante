-- Migration: AddDocumentFieldsToCustomer
-- Description: Adds DocumentType and DocumentNumber fields to Customers table
-- Date: 2026-01-14

-- Add DocumentType column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Customers]') AND name = 'DocumentType')
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [DocumentType] NVARCHAR(MAX) NULL;
    PRINT 'DocumentType column added successfully';
END
ELSE
BEGIN
    PRINT 'DocumentType column already exists';
END
GO

-- Add DocumentNumber column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Customers]') AND name = 'DocumentNumber')
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [DocumentNumber] NVARCHAR(MAX) NULL;
    PRINT 'DocumentNumber column added successfully';
END
ELSE
BEGIN
    PRINT 'DocumentNumber column already exists';
END
GO
