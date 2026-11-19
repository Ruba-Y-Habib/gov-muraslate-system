import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { query, queryOne } from '../db.js';
import { authMiddleware } from '../auth.js';
import { notifyUser } from '../socket.js';

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads');
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '15', 10);

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.txt', '.csv', '.zip', '.rar', '.7z',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error(`نوع الملف غير مسموح: ${ext || 'غير معروف'}`));
    }
    cb(null, true);
  },
});

router.use(authMiddleware);

// المراسلات الخارجية: موظفو المديرية (أدمن/مدير/رؤساء أقسام) + حسابات الجهات الخارجية (رسائل جهتها فقط)
const allow = (req) => ['admin', 'director', 'dept_head'].includes(req.user.Role);
const isExternal = (req) => req.user.Role === 'external';
const externalEntityIdOf = (req) => req.user.ExternalEntityId ?? null;

// ترقيم ديواني: ص/السنة/تسلسل للصادر، و/السنة/تسلسل للوارد
const nextNumber = async (direction) => {
  const prefix = direction === 'out' ? 'ص' : 'و';
  const year = new Date().getFullYear();
  const r = await queryOne(
    `SELECT COUNT(*) AS N FROM ExternalMessages WHERE Direction = @dir AND YEAR(Date) = @year`,
    { dir: direction, year }
  );
  const seq = String((r?.N || 0) + 1).padStart(3, '0');
  return `${prefix}/${year}/${seq}`;
};

// GET /api/external?direction=&entityId=&q=&archived= — قائمة الرسائل الخارجية
router.get('/', async (req, res, next) => {
  try {
    if (!allow(req) && !isExternal(req)) return res.status(403).json({ error: 'المراسلات الخارجية متاحة لموظفي المديرية المخوّلين فقط' });
    const { direction, entityId, q, archived } = req.query;
    const clauses = [];
    const params = { me: req.user.Id };
    if (isExternal(req)) {
      // حساب الجهة يرى رسائل جهته غير المؤرشفة فقط
      clauses.push('m.EntityId = @meEntity');
      params.meEntity = externalEntityIdOf(req);
      clauses.push('m.Archived = 0');
    }
    if (direction === 'out' || direction === 'in') {
      clauses.push('m.Direction = @direction');
      params.direction = direction;
    }
    if (entityId && !Number.isNaN(parseInt(entityId, 10))) {
      clauses.push('m.EntityId = @entityId');
      params.entityId = parseInt(entityId, 10);
    }
    if (q && String(q).trim()) {
      clauses.push('(m.Subject LIKE @q OR m.Number LIKE @q OR m.Body LIKE @q OR e.Name LIKE @q)');
      params.q = `%${String(q).trim()}%`;
    }
    if (archived === '1' && !isExternal(req)) {
      clauses.push('m.Archived = 1');
    } else if (archived === '0') {
      clauses.push('m.Archived = 0');
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await query(
      `SELECT m.Id, m.Number, m.Direction, m.Date, m.Subject, m.Archived, m.CreatedAt,
              CASE WHEN EXISTS (SELECT 1 FROM ExternalReads r WHERE r.MessageId = m.Id AND r.UserId = @me) THEN 0 ELSE 1 END AS Unread,
              e.Name AS EntityName, e.SectionName AS EntitySection,
              u.FullName AS CreatedByName
       FROM ExternalMessages m
       JOIN ExternalEntities e ON e.Id = m.EntityId
       JOIN Users u ON u.Id = m.CreatedByUserId
       ${where}
       ORDER BY m.Date DESC, m.Id DESC`,
      params
    );
    res.json(rows.recordset.map(m => ({
      id: m.Id,
      number: m.Number,
      direction: m.Direction,
      date: m.Date,
      subject: m.Subject,
      archived: !!m.Archived,
      unread: !!m.Unread,
      entityName: m.EntityName,
      entitySection: m.EntitySection || '',
      createdByName: m.CreatedByName,
      createdAt: m.CreatedAt,
    })));
  } catch (err) { next(err); }
});

// POST /api/external — تسجيل رسالة خارجية (واردة أو صادرة) مع مرفقات اختيارية
router.post('/', upload.array('attachments', 10), async (req, res, next) => {
  try {
    if (!allow(req) && !isExternal(req)) return res.status(403).json({ error: 'لا تملك صلاحية تسجيل مراسلة خارجية' });
    const external = isExternal(req);
    const { entityId, number, subject, body, date } = req.body || {};
    let direction = req.body.direction;
    if (external) {
      // حساب الجهة يرسل دائماً كمراسلة واردة على المديرية وباسم جهته
      direction = 'in';
    } else if (!direction || !['out', 'in'].includes(direction)) {
      return res.status(400).json({ error: 'نوع المراسلة مطلوب: صادرة (out) أو واردة (in)' });
    }
    let eid = parseInt(entityId, 10);
    if (external) eid = externalEntityIdOf(req);
    if (Number.isNaN(eid)) return res.status(400).json({ error: 'الجهة الخارجية مطلوبة' });
    const entity = await queryOne('SELECT Id, Name FROM ExternalEntities WHERE Id = @id AND IsActive = 1', { id: eid });
    if (!entity) return res.status(404).json({ error: 'الجهة الخارجية غير موجودة أو معطّلة' });
    if (!subject || !String(subject).trim()) return res.status(400).json({ error: 'موضوع المراسلة مطلوب' });
    if (!body || !String(body).trim()) return res.status(400).json({ error: 'نص المراسلة مطلوب' });

    // رقم الديوان: يُولَّد تلقائياً إذا تُرك فارغاً، مع إمكانية الإدخال اليدوي
    let finalNumber = String(number || '').trim();
    if (!finalNumber) finalNumber = await nextNumber(direction);
    const dupe = await queryOne('SELECT Id FROM ExternalMessages WHERE Number = @n', { n: finalNumber });
    if (dupe) return res.status(409).json({ error: `الرقم «${finalNumber}» مستخدم مسبقاً — أدخل رقماً آخر أو اتركه فارغاً للتوليد التلقائي` });

    let msgDate = new Date();
    if (date && !Number.isNaN(Date.parse(date))) msgDate = new Date(date);

    const r = await query(
      `INSERT INTO ExternalMessages (Number, Direction, EntityId, Date, Subject, Body, CreatedByUserId)
       OUTPUT INSERTED.Id
       VALUES (@number, @direction, @entityId, @date, @subject, @body, @userId)`,
      {
        number: finalNumber,
        direction,
        entityId: eid,
        date: msgDate,
        subject: String(subject).trim(),
        body: String(body),
        userId: req.user.Id,
      }
    );
    const messageId = r.recordset[0].Id;

    // حفظ المرفقات
    const files = req.files || [];
    for (const f of files) {
      await query(
        `INSERT INTO ExternalAttachments (MessageId, FileName, StoredName, ContentType, SizeBytes)
         VALUES (@mid, @fname, @sname, @ctype, @size)`,
        { mid: messageId, fname: f.originalname, sname: f.filename, ctype: f.mimetype || null, size: f.size || 0 }
      );
    }

    // إشعارات: موظفو المديرية المخوّلون + حساب الجهة المعنية
    const notifyTitle = direction === 'out'
      ? `كتاب صادر جديد إلى ${entity.Name}`
      : (external ? `مراسلة جديدة واردة من ${entity.Name}` : `سُجّل كتاب وارد من ${entity.Name}`);
    const notifyText = `${finalNumber} — ${subject}`;
    const staffRows = await query(
      `SELECT Id FROM Users WHERE IsActive = 1 AND Role IN ('admin','director','dept_head') AND Id <> @creator`,
      { creator: req.user.Id }
    );
    for (const u of staffRows.recordset) {
      await query('INSERT INTO Notifications (UserId, ExternalMessageId, Title, Message) VALUES (@uid, @mid, @t, @m)',
        { uid: u.Id, mid: messageId, t: notifyTitle, m: notifyText });
      notifyUser(u.Id, { externalMessageId: messageId, fromName: entity.Name, subject });
    }
    if (!external) {
      const entUser = await queryOne(`SELECT Id FROM Users WHERE ExternalEntityId = @eid AND Role = 'external' AND IsActive = 1`, { eid });
      if (entUser && entUser.Id !== req.user.Id) {
        const entTitle = direction === 'out' ? 'كتاب جديد من مديرية مالية اللاذقية' : `تم تسجيل كتابكم برقم ${finalNumber}`;
        await query('INSERT INTO Notifications (UserId, ExternalMessageId, Title, Message) VALUES (@uid, @mid, @t, @m)',
          { uid: entUser.Id, mid: messageId, t: entTitle, m: notifyText });
        notifyUser(entUser.Id, { externalMessageId: messageId, fromName: 'مديرية مالية اللاذقية', subject });
      }
    }

    res.status(201).json({
      id: messageId,
      number: finalNumber,
      direction,
      entityName: entity.Name,
      attachments: files.length,
      message: `تم تسجيل المراسلة ${direction === 'out' ? 'الصادرة' : 'الواردة'} برقم «${finalNumber}» بنجاح`,
    });
  } catch (err) { next(err); }
});

// GET /api/external/:id — تفاصيل رسالة خارجية مع مرفقاتها
router.get('/:id', async (req, res, next) => {
  try {
    if (!allow(req) && !isExternal(req)) return res.status(403).json({ error: 'المراسلات الخارجية متاحة لموظفي المديرية المخوّلين فقط' });
    const id = parseInt(req.params.id, 10);
    const m = await queryOne(
      `SELECT m.Id, m.Number, m.Direction, m.Date, m.Subject, m.Body, m.Archived, m.CreatedAt, m.EntityId,
              e.Name AS EntityName, e.SectionName AS EntitySection, e.ContactInfo AS EntityContact,
              u.FullName AS CreatedByName
       FROM ExternalMessages m
       JOIN ExternalEntities e ON e.Id = m.EntityId
       JOIN Users u ON u.Id = m.CreatedByUserId
       WHERE m.Id = @id`,
      { id }
    );
    if (!m) return res.status(404).json({ error: 'المراسلة الخارجية غير موجودة' });
    if (isExternal(req) && m.EntityId !== (req.user.ExternalEntityId ?? -1)) {
      return res.status(403).json({ error: 'هذه المراسلة ليست لجهتك' });
    }
    // تسجيل القراءة لهذا المستخدم
    await query(
      `IF NOT EXISTS (SELECT 1 FROM ExternalReads WHERE MessageId = @id AND UserId = @uid)
       INSERT INTO ExternalReads (MessageId, UserId) VALUES (@id, @uid)`,
      { id, uid: req.user.Id }
    );
    const atts = await query(
      'SELECT Id, FileName, SizeBytes, ContentType, CreatedAt FROM ExternalAttachments WHERE MessageId = @id ORDER BY Id',
      { id }
    );
    res.json({
      id: m.Id,
      number: m.Number,
      direction: m.Direction,
      date: m.Date,
      subject: m.Subject,
      body: m.Body,
      archived: !!m.Archived,
      createdAt: m.CreatedAt,
      entity: {
        id: m.EntityId,
        name: m.EntityName,
        sectionName: m.EntitySection || '',
        contactInfo: m.EntityContact || '',
      },
      createdByName: m.CreatedByName,
      attachments: atts.recordset.map(a => ({
        id: a.Id,
        fileName: a.FileName,
        sizeBytes: a.SizeBytes,
        contentType: a.ContentType,
        createdAt: a.CreatedAt,
      })),
    });
  } catch (err) { next(err); }
});

// POST /api/external/:id/archive — أرشفة/إلغاء أرشفة
router.post('/:id/archive', async (req, res, next) => {
  try {
    if (!allow(req)) return res.status(403).json({ error: 'الأرشفة متاحة لموظفي المديرية المخوّلين فقط' });
    const id = parseInt(req.params.id, 10);
    const m = await queryOne('SELECT Id, Archived FROM ExternalMessages WHERE Id = @id', { id });
    if (!m) return res.status(404).json({ error: 'المراسلة الخارجية غير موجودة' });
    const nextVal = m.Archived ? 0 : 1;
    await query('UPDATE ExternalMessages SET Archived = @v WHERE Id = @id', { v: nextVal, id });
    res.json({ id, archived: !!nextVal, message: nextVal ? 'تمت أرشفة المراسلة' : 'أُعيدت المراسلة من الأرشيف' });
  } catch (err) { next(err); }
});

// GET /api/external/attachment/:attId — تنزيل مرفق
router.get('/attachment/:attId', async (req, res, next) => {
  try {
    if (!allow(req) && !isExternal(req)) return res.status(403).json({ error: 'لا تملك صلاحية الوصول' });
    const attId = parseInt(req.params.attId, 10);
    const a = await queryOne(
      `SELECT a.Id, a.FileName, a.StoredName, a.ContentType, m.EntityId
       FROM ExternalAttachments a JOIN ExternalMessages m ON m.Id = a.MessageId
       WHERE a.Id = @id`,
      { id: attId }
    );
    if (!a) return res.status(404).json({ error: 'المرفق غير موجود' });
    if (isExternal(req) && a.EntityId !== (req.user.ExternalEntityId ?? -1)) {
      return res.status(403).json({ error: 'هذا المرفق ليس لجهتك' });
    }
    const filePath = path.join(UPLOAD_DIR, a.StoredName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'ملف المرفق مفقود على الخادم' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(filePath, a.FileName);
  } catch (err) { next(err); }
});

export default router;
