USE [MurasalatDB];
GO

IF OBJECT_ID('dbo.Departments') IS NULL
CREATE TABLE dbo.Departments (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Name NVARCHAR(200) NOT NULL UNIQUE,
  HeadName NVARCHAR(200) NULL,
  HeadTitle NVARCHAR(200) NULL,
  Phone NVARCHAR(50) NULL,
  Email NVARCHAR(200) NULL,
  Office NVARCHAR(200) NULL,
  IsActive BIT NOT NULL DEFAULT 1,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

IF OBJECT_ID('dbo.Users') IS NULL
CREATE TABLE dbo.Users (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  FullName NVARCHAR(200) NOT NULL,
  Username NVARCHAR(100) NOT NULL UNIQUE,
  PasswordHash NVARCHAR(200) NOT NULL,
  Role NVARCHAR(20) NOT NULL CHECK (Role IN ('admin','director','dept_head')),
  DepartmentId INT NULL REFERENCES dbo.Departments(Id),
  IsActive BIT NOT NULL DEFAULT 1,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

IF OBJECT_ID('dbo.Correspondences') IS NULL
CREATE TABLE dbo.Correspondences (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Number NVARCHAR(50) NOT NULL,
  Date DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FromUserId INT NOT NULL REFERENCES dbo.Users(Id),
  ToUserId INT NOT NULL REFERENCES dbo.Users(Id),
  Subject NVARCHAR(500) NOT NULL,
  Body NVARCHAR(MAX) NOT NULL,
  Priority NVARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (Priority IN ('low','normal','high','urgent')),
  Status NVARCHAR(10) NOT NULL DEFAULT 'sent' CHECK (Status IN ('sent','read','archived')),
  ReplyToId INT NULL REFERENCES dbo.Correspondences(Id),
  ReadAt DATETIME2 NULL,
  RepliedAt DATETIME2 NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

IF OBJECT_ID('dbo.Attachments') IS NULL
CREATE TABLE dbo.Attachments (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  CorrespondenceId INT NOT NULL REFERENCES dbo.Correspondences(Id) ON DELETE CASCADE,
  FileName NVARCHAR(500) NOT NULL,
  StoredName NVARCHAR(200) NOT NULL,
  ContentType NVARCHAR(200) NULL,
  SizeBytes INT NOT NULL DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

IF OBJECT_ID('dbo.Notifications') IS NULL
CREATE TABLE dbo.Notifications (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  UserId INT NOT NULL REFERENCES dbo.Users(Id),
  CorrespondenceId INT NULL REFERENCES dbo.Correspondences(Id) ON DELETE CASCADE,
  Title NVARCHAR(300) NOT NULL,
  Message NVARCHAR(MAX) NULL,
  IsRead BIT NOT NULL DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Correspondences_ToUser')
  CREATE INDEX IX_Correspondences_ToUser ON dbo.Correspondences(ToUserId, Status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Correspondences_FromUser')
  CREATE INDEX IX_Correspondences_FromUser ON dbo.Correspondences(FromUserId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_User')
  CREATE INDEX IX_Notifications_User ON dbo.Notifications(UserId, IsRead);
GO
