/**
 * إعداد النظام: إنشاء قاعدة البيانات والجداول وإدخال الحسابات الأولية
 * التشغيل: npm run setup
 */
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_NAME = process.env.DB_NAME || 'MurasalatDB';
const masterConfig = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: (process.env.DB_ENCRYPT || 'false') === 'true',
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 60000,
};

const dbConfig = { ...masterConfig, database: DB_NAME };

async function run() {
  console.log('الخطوة 1/3: الاتصال بـ SQL Server...');
  const masterPool = await new sql.ConnectionPool(masterConfig).connect();

  const dbCheck = await masterPool.request()
    .query(`SELECT DB_ID('${DB_NAME.replace(/'/g, "''")}') AS DbId`);
  if (!dbCheck.recordset[0].DbId) {
    console.log(`الخطوة 2/3: إنشاء قاعدة البيانات ${DB_NAME}...`);
    await masterPool.query(`CREATE DATABASE [${DB_NAME.replace(/'/g, "''")}]`);
  } else {
    console.log(`الخطوة 2/3: قاعدة البيانات ${DB_NAME} موجودة مسبقاً.`);
  }
  await masterPool.close();

  const pool = await new sql.ConnectionPool(dbConfig).connect();
  const req1 = pool.request();

  console.log('إنشاء الجداول...');
  await req1.query(`
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

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Correspondences_ToUser')
      CREATE INDEX IX_Correspondences_ToUser ON dbo.Correspondences(ToUserId, Status);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Correspondences_FromUser')
      CREATE INDEX IX_Correspondences_FromUser ON dbo.Correspondences(FromUserId);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_User')
      CREATE INDEX IX_Notifications_User ON dbo.Notifications(UserId, IsRead);

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

    /* ===== ترقية قواعد بيانات قائمة: حسابات الجهات وحالات القراءة ===== */
    IF COL_LENGTH('dbo.Users','ExternalEntityId') IS NULL
      ALTER TABLE dbo.Users ADD ExternalEntityId INT NULL REFERENCES dbo.ExternalEntities(Id);

    DECLARE @ck NVARCHAR(200);
    SELECT @ck = name FROM sys.check_constraints
     WHERE parent_object_id = OBJECT_ID('dbo.Users')
       AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.Users'),'Role','ColumnId');
    IF @ck IS NOT NULL
    BEGIN
      DECLARE @dropsql NVARCHAR(MAX) = N'ALTER TABLE dbo.Users DROP CONSTRAINT ' + QUOTENAME(@ck);
      EXEC(@dropsql);
    END
    ALTER TABLE dbo.Users ADD CHECK (Role IN ('admin','director','dept_head','external'));

    IF OBJECT_ID('dbo.ExternalReads') IS NULL
    CREATE TABLE dbo.ExternalReads (
      MessageId INT NOT NULL REFERENCES dbo.ExternalMessages(Id) ON DELETE CASCADE,
      UserId INT NOT NULL REFERENCES dbo.Users(Id),
      ReadAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
      PRIMARY KEY (MessageId, UserId)
    );

    IF COL_LENGTH('dbo.Notifications','ExternalMessageId') IS NULL
      ALTER TABLE dbo.Notifications ADD ExternalMessageId INT NULL REFERENCES dbo.ExternalMessages(Id) ON DELETE CASCADE;
  `);
  console.log('تم إنشاء الجداول (أو موجودة مسبقاً).');

  console.log('الخطوة 3/3: إدخال البيانات الأولية...');
  const departments = [
    ['قسم الموازنة', 'أ. سامر العلي', 'رئيس قسم الموازنة', '041-234567', 'budget@latakia-finance.gov.sy', 'الطابق الثاني - غرفة 201'],
    ['قسم الحسابات', 'أ. رنا يوسف', 'رئيسة قسم الحسابات', '041-234568', 'accounts@latakia-finance.gov.sy', 'الطابق الثاني - غرفة 205'],
    ['قسم الرواتب والأجور', 'أ. أحمد المصري', 'رئيس قسم الرواتب والأجور', '041-234569', 'salaries@latakia-finance.gov.sy', 'الطابق الثالث - غرفة 301'],
    ['قسم الضرائب', 'أ. ليلى حسن', 'رئيسة قسم الضرائب', '041-234570', 'tax@latakia-finance.gov.sy', 'الطابق الثالث - غرفة 305'],
    ['قسم الرقابة المالية', 'أ. خالد درويش', 'رئيس قسم الرقابة المالية', '041-234571', 'audit@latakia-finance.gov.sy', 'الطابق الرابع - غرفة 401'],
    ['قسم المشتريات', 'أ. فاطمة ناصر', 'رئيسة قسم المشتريات', '041-234572', 'procurement@latakia-finance.gov.sy', 'الطابق الرابع - غرفة 405'],
  ];

  for (const [name, headName, headTitle, phone, email, office] of departments) {
    const exists = await pool.request().input('name', name)
      .query('SELECT Id FROM Departments WHERE Name = @name');
    if (!exists.recordset.length) {
      await pool.request()
        .input('name', name).input('headName', headName).input('headTitle', headTitle)
        .input('phone', phone).input('email', email).input('office', office)
        .query(`INSERT INTO Departments (Name, HeadName, HeadTitle, Phone, Email, Office)
                VALUES (@name, @headName, @headTitle, @phone, @email, @office)`);
      console.log(`  + أُضيف القسم: ${name}`);
    }
  }

  const deptRows = await pool.request().query('SELECT Id, Name FROM Departments');
  const deptId = (name) => deptRows.recordset.find(d => d.Name === name)?.Id || null;

  const users = [
    { fullName: 'مدير النظام', username: 'admin', password: process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@2026', role: 'admin', department: null },
    { fullName: 'أ. محمد خليل الحسن', username: 'director', password: 'Director@2026', role: 'director', department: null },
    { fullName: 'أ. سامر العلي', username: 'budget.head', password: 'Dept@2026', role: 'dept_head', department: 'قسم الموازنة' },
    { fullName: 'أ. رنا يوسف', username: 'accounts.head', password: 'Dept@2026', role: 'dept_head', department: 'قسم الحسابات' },
    { fullName: 'أ. أحمد المصري', username: 'salaries.head', password: 'Dept@2026', role: 'dept_head', department: 'قسم الرواتب والأجور' },
    { fullName: 'أ. ليلى حسن', username: 'tax.head', password: 'Dept@2026', role: 'dept_head', department: 'قسم الضرائب' },
    { fullName: 'أ. خالد درويش', username: 'audit.head', password: 'Dept@2026', role: 'dept_head', department: 'قسم الرقابة المالية' },
    { fullName: 'أ. فاطمة ناصر', username: 'procurement.head', password: 'Dept@2026', role: 'dept_head', department: 'قسم المشتريات' },
  ];

  for (const u of users) {
    const exists = await pool.request().input('username', u.username)
      .query('SELECT Id FROM Users WHERE Username = @username');
    if (!exists.recordset.length) {
      const hash = await bcrypt.hash(u.password, 10);
      await pool.request()
        .input('fullName', u.fullName).input('username', u.username).input('hash', hash)
        .input('role', u.role).input('dept', deptId(u.department))
        .query(`INSERT INTO Users (FullName, Username, PasswordHash, Role, DepartmentId)
                VALUES (@fullName, @username, @hash, @role, @dept)`);
      console.log(`  + أُنشئ الحساب: ${u.username} (${u.fullName})`);
    }
  }

  // حسابات نظامية للجهات الخارجية القائمة بلا حساب (للترقية)
  const entsNoAcc = await pool.request().query(`
    SELECT e.Id, e.Name FROM ExternalEntities e
    WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.ExternalEntityId = e.Id)`);
  let entSeq = (await pool.request().query("SELECT COUNT(*) AS N FROM Users WHERE Role = 'external'")).recordset[0].N;
  for (const ent of entsNoAcc.recordset) {
    entSeq += 1;
    let username = `entity${entSeq}`;
    while ((await pool.request().input('u', username).query('SELECT Id FROM Users WHERE Username = @u')).recordset.length) {
      entSeq += 1;
      username = `entity${entSeq}`;
    }
    const entPassword = crypto.randomBytes(4).toString('hex');
    const entHash = await bcrypt.hash(entPassword, 10);
    await pool.request()
      .input('fullName', ent.Name).input('username', username).input('hash', entHash)
      .input('eid', ent.Id)
      .query(`INSERT INTO Users (FullName, Username, PasswordHash, Role, DepartmentId, ExternalEntityId, IsActive)
              VALUES (@fullName, @username, @hash, 'external', NULL, @eid, 1)`);
    console.log(`  + أُنشئ حساب الجهة «${ent.Name}»: ${username} / ${entPassword}`);
  }

  await pool.close();
  console.log('');
  console.log('اكتمل الإعداد بنجاح ✅');
  console.log('حساب مدير النظام:  admin / Admin@2026');
  console.log('حساب المدير:       director / Director@2026');
  console.log('حسابات رؤساء الأقسام: <اسم-المستخدم>.head / Dept@2026');
  console.log('مهم: غيّر كلمات المرور هذه بعد أول تسجيل دخول.');
  process.exit(0);
}

run().catch(err => {
  console.error('');
  console.error('فشل الإعداد:', err.message);
  console.error('');
  console.error('تحقق من:');
  console.error('1. أن خدمة SQL Server تعمل (SQL Server Configuration Manager)');
  console.error('2. بيانات الاتصال في ملف .env (DB_SERVER, DB_USER, DB_PASSWORD)');
  console.error('3. أن مصادقة SQL Server مفعلة (Mixed Mode) في SSMS');
  process.exit(1);
});
