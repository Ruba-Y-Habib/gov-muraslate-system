import { query } from './db.js';

const sqlText = `
IF OBJECT_ID('dbo.ExternalEntities') IS NULL
CREATE TABLE dbo.ExternalEntities (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Name NVARCHAR(200) NOT NULL,
  SectionName NVARCHAR(200) NULL,
  ContactInfo NVARCHAR(300) NULL,
  IsActive BIT NOT NULL DEFAULT 1,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
IF OBJECT_ID('dbo.ExternalMessages') IS NULL
CREATE TABLE dbo.ExternalMessages (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Number NVARCHAR(50) NOT NULL,
  Direction NVARCHAR(10) NOT NULL CHECK (Direction IN ('out','in')),
  EntityId INT NOT NULL REFERENCES dbo.ExternalEntities(Id),
  Date DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  Subject NVARCHAR(500) NOT NULL,
  Body NVARCHAR(MAX) NOT NULL,
  Archived BIT NOT NULL DEFAULT 0,
  CreatedByUserId INT NOT NULL REFERENCES dbo.Users(Id),
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
IF OBJECT_ID('dbo.ExternalAttachments') IS NULL
CREATE TABLE dbo.ExternalAttachments (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  MessageId INT NOT NULL REFERENCES dbo.ExternalMessages(Id) ON DELETE CASCADE,
  FileName NVARCHAR(500) NOT NULL,
  StoredName NVARCHAR(200) NOT NULL,
  ContentType NVARCHAR(200) NULL,
  SizeBytes INT NOT NULL DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ExternalMessages_Entity')
  CREATE INDEX IX_ExternalMessages_Entity ON dbo.ExternalMessages(EntityId, Direction);
`;

await query(sqlText);
console.log('MIGRATION_OK: external tables ready');
process.exit(0);
