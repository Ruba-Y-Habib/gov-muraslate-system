import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { query, queryOne, sql } from '../db.js';
import { authMiddleware, requireAdmin } from '../auth.js';
import { notifyUser } from '../socket.js';

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

const router = express.Router();
router.use(authMiddleware);

// حسابات الجهات الخارجية مخصصة للمراسلات الخارجية فقط
router.use((req, res, next) => {
  if (req.user?.Role === 'external') {
    return res.status(403).json({ error: 'حساب الجهة الخارجية مخصص للمراسلات الخارجية فقط' });
  }
  next();
});

const CORR_SELECT = `
  SELECT c.Id, c.Number, c.Date, c.Subject, c.Body, c.Priority, c.Status,
         c.FromUserId, c.ToUserId, c.ReadAt, c.RepliedAt, c.ReplyToId, c.CreatedAt,
         uf.FullName AS FromName, df.Name AS FromDepartment,
         ut.FullName AS ToName, dt.Name AS ToDepartment,
         (SELECT COUNT(*) FROM Attachments a WHERE a.CorrespondenceId = c.Id) AS AttachmentCount,
         (SELECT TOP 1 r.Number FROM Correspondences r WHERE r.Id = c.ReplyToId) AS ReplyToNumber
  FROM Correspondences c
  JOIN Users uf ON uf.Id = c.FromUserId
  JOIN Users ut ON ut.Id = c.ToUserId
  LEFT JOIN Departments df ON df.Id = uf.DepartmentId
  LEFT JOIN Departments dt ON dt.Id = ut.DepartmentId
`;

function mapRow(r) {
  return {
    id: r.Id,
    number: r.Number,
    date: r.Date,
    subject: r.Subject,
    body: r.Body,
    priority: r.Priority,
    status: r.Status,
    fromUserId: r.FromUserId,
    toUserId: r.ToUserId,
    from: r.FromName,
    fromDepartment: r.FromDepartment || '—',
    to: r.ToName,
    toDepartment: r.ToDepartment || '—',
    readAt: r.ReadAt,
    repliedAt: r.RepliedAt,
    replyToId: r.ReplyToId,
    replyToNumber: r.ReplyToNumber,
    attachmentCount: r.AttachmentCount,
    type: null, // set per viewer below
  };
}

function withType(row, viewerId) {
  row.type = row.toUserId === viewerId ? 'incoming' : 'outgoing';
  return row;
}

// GET /api/correspondences?box=incoming|sent|archived|all
router.get('/', async (req, res, next) => {
  try {
    const me = req.user.Id;
    const box = req.query.box || 'incoming';
    let where = '';
    if (box === 'incoming') {
      where = 'WHERE c.ToUserId = @me AND c.Status <> \'archived\'';
    } else if (box === 'sent') {
      where = 'WHERE c.FromUserId = @me';
    } else if (box === 'archived') {
      where = 'WHERE c.Status = \'archived\' AND (c.ToUserId = @me OR c.FromUserId = @me)';
    } else if (box === 'all') {
      if (req.user.Role !== 'admin') {
        return res.status(403).json({ error: 'هذه القائمة متاحة لمدير النظام فقط' });
      }
      where = '';
    } else {
      return res.status(400).json({ error: 'صندوق غير معروف' });
    }
    const result = await query(
      `${CORR_SELECT} ${where} ORDER BY c.Date DESC`,
      { me }
    );
    res.json(result.recordset.map(r => withType(mapRow(r), me)));
  } catch (err) {
    next(err);
  }
});

// GET /api/correspondences/:id
router.get('/:id', async (req, res, next) => {
  try {
    const me = req.user.Id;
    const row = await queryOne(`${CORR_SELECT} WHERE c.Id = @id`, { id: parseInt(req.params.id, 10) });
    if (!row) return res.status(404).json({ error: 'المراسلة غير موجودة' });
    if (req.user.Role !== 'admin' && row.FromUserId !== me && row.ToUserId !== me) {
      return res.status(403).json({ error: 'لا تملك صلاحية عرض هذه المراسلة' });
    }
    const atts = await query(
      'SELECT Id, FileName, SizeBytes, ContentType, CreatedAt FROM Attachments WHERE CorrespondenceId = @id ORDER BY Id',
      { id: row.Id }
    );
    // Mark as read when the recipient opens it
    if (row.ToUserId === me && row.Status === 'sent') {
      await query(
        'UPDATE Correspondences SET Status = \'read\', ReadAt = SYSDATETIME() WHERE Id = @id',
        { id: row.Id }
      );
      row.Status = 'read';
      row.ReadAt = new Date();
      await query(
        'UPDATE Notifications SET IsRead = 1 WHERE UserId = @me AND CorrespondenceId = @id AND IsRead = 0',
        { me, id: row.Id }
      );
    }
    const mapped = withType(mapRow(row), me);
    mapped.attachments = atts.recordset.map(a => ({
      id: a.Id,
      fileName: a.FileName,
      sizeBytes: a.SizeBytes,
      contentType: a.ContentType,
      createdAt: a.CreatedAt,
    }));

    // سجل المحادثة الكاملة: نحدد جذر السلسلة بالصعود عبر ReplyToId، ثم نجمع
    // الجذر وكل نسخه الموزعة (نفس الرقم) وكل الردود المتفرعة منها
    let root = row;
    for (let i = 0; i < 50 && root.ReplyToId; i++) {
      const anc = await queryOne('SELECT Id, Number, ReplyToId FROM Correspondences WHERE Id = @pid', { pid: root.ReplyToId });
      if (!anc) break;
      root = anc;
    }
    const thread = await query(
      `WITH Family(Id) AS (
         SELECT Id FROM Correspondences
         WHERE Id = @rootId OR (@rootNumber IS NOT NULL AND Number = @rootNumber)
         UNION ALL
         SELECT c.Id FROM Correspondences c INNER JOIN Family f ON c.ReplyToId = f.Id
       )
       SELECT c.Id, c.Number, c.Date, c.Subject,
              uf.FullName AS FromName, df.Name AS FromDept,
              ut.FullName AS ToName, dt.Name AS ToDept
       FROM Correspondences c
       INNER JOIN Family f ON f.Id = c.Id
       JOIN Users uf ON uf.Id = c.FromUserId
       JOIN Users ut ON ut.Id = c.ToUserId
       LEFT JOIN Departments df ON df.Id = uf.DepartmentId
       LEFT JOIN Departments dt ON dt.Id = ut.DepartmentId
       WHERE @admin = 1
          OR EXISTS (
            SELECT 1 FROM Family f2
            INNER JOIN Correspondences c2 ON c2.Id = f2.Id
            WHERE c2.FromUserId = @me OR c2.ToUserId = @me
          )
       ORDER BY c.Date ASC, c.Id ASC
       OPTION (MAXRECURSION 100)`,
      { rootId: root.Id, rootNumber: root.Number, me, admin: req.user.Role === 'admin' ? 1 : 0 }
    );
    mapped.thread = thread.recordset.map(t => ({
      id: t.Id,
      number: t.Number,
      date: t.Date,
      subject: t.Subject,
      from: t.FromName,
      fromDepartment: t.FromDept || '—',
      to: t.ToName,
      toDepartment: t.ToDept || '—',
    }));

    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

// POST /api/correspondences  (multipart: toUserId, subject, body, priority, replyToId?, attachments[])
router.post('/', upload.array('attachments', 10), async (req, res, next) => {
  try {
    const me = req.user;
    const toUserId = req.body.toUserId ? parseInt(req.body.toUserId, 10) : null;
    const departmentId = req.body.departmentId ? parseInt(req.body.departmentId, 10) : null;
    const subject = (req.body.subject || '').trim();
    const body = (req.body.body || '').trim();
    const priority = ['low', 'normal', 'high', 'urgent'].includes(req.body.priority) ? req.body.priority : 'normal';
    const replyToId = req.body.replyToId ? parseInt(req.body.replyToId, 10) : null;

    if (!subject) return res.status(400).json({ error: 'يرجى إدخال الموضوع' });
    if (!body) return res.status(400).json({ error: 'يرجى كتابة نص المراسلة' });

    // المستلم إما مستخدم واحد أو قسم كامل (توزيع على جميع منتسبيه النشطين)
    let recipients = [];
    if (toUserId) {
      const recipient = await queryOne(
        'SELECT Id, FullName, IsActive FROM Users WHERE Id = @id',
        { id: toUserId }
      );
      if (!recipient || !recipient.IsActive) {
        return res.status(400).json({ error: 'المستلم غير موجود أو الحساب معطل' });
      }
      if (recipient.Id === me.Id) {
        return res.status(400).json({ error: 'لا يمكن إرسال مراسلة لنفسك' });
      }
      recipients = [recipient];
    } else if (departmentId) {
      const dept = await queryOne(
        'SELECT Id, Name FROM Departments WHERE Id = @id AND IsActive = 1',
        { id: departmentId }
      );
      if (!dept) return res.status(400).json({ error: 'القسم غير موجود أو معطل' });
      const members = await query(
        'SELECT Id, FullName FROM Users WHERE DepartmentId = @id AND IsActive = 1 AND Id <> @me',
        { id: departmentId, me: me.Id }
      );
      recipients = members.recordset;
      if (recipients.length === 0) {
        return res.status(400).json({ error: 'لا يوجد موظفون نشطون في هذا القسم لإرسال المراسلة إليهم' });
      }
    } else {
      return res.status(400).json({ error: 'يرجى تحديد المستلم (شخص أو قسم)' });
    }
    if (replyToId) {
      const parent = await queryOne('SELECT Id, FromUserId, ToUserId FROM Correspondences WHERE Id = @id', { id: replyToId });
      if (!parent || (parent.FromUserId !== me.Id && parent.ToUserId !== me.Id)) {
        return res.status(400).json({ error: 'المراسلة الأصلية غير موجودة' });
      }
    }

    // Sequential number per year: م.م/2026/146
    const year = new Date().getFullYear();
    const seqRow = await queryOne(
      'SELECT COUNT(*) AS N FROM Correspondences WHERE YEAR(Date) = @year',
      { year }
    );
    const seq = (seqRow?.N || 0) + 1;
    const number = `م.م/${year}/${seq}`;

    const pool = await (await import('../db.js')).getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      let corrId = null;
      const notified = [];

      for (const rcpt of recipients) {
        const request = new sql.Request(tx);
        request.input('number', sql.NVarChar(50), number);
        request.input('fromUserId', sql.Int, me.Id);
        request.input('toUserId', sql.Int, rcpt.Id);
        request.input('subject', sql.NVarChar(500), subject);
        request.input('body', sql.NVarChar(sql.MAX), body);
        request.input('priority', sql.NVarChar(10), priority);
        request.input('replyToId', sql.Int, replyToId);
        const ins = await request.query(`
          INSERT INTO Correspondences (Number, FromUserId, ToUserId, Subject, Body, Priority, Status, ReplyToId)
          OUTPUT INSERTED.Id
          VALUES (@number, @fromUserId, @toUserId, @subject, @body, @priority, 'sent', @replyToId)
        `);
        const rcptCorrId = ins.recordset[0].Id;
        if (!corrId) corrId = rcptCorrId;

        // نفس الملفات تُرفق لكل نسخة (بدون تكرار على القرص — مرجع لنفس الملف المخزّن)
        for (const f of req.files || []) {
          const aReq = new sql.Request(tx);
          aReq.input('corrId', sql.Int, rcptCorrId);
          aReq.input('fileName', sql.NVarChar(500), f.originalname);
          aReq.input('storedName', sql.NVarChar(200), f.filename);
          aReq.input('contentType', sql.NVarChar(200), f.mimetype);
          aReq.input('sizeBytes', sql.Int, f.size);
          await aReq.query(`
            INSERT INTO Attachments (CorrespondenceId, FileName, StoredName, ContentType, SizeBytes)
            VALUES (@corrId, @fileName, @storedName, @contentType, @sizeBytes)
          `);
        }

        const notifTitle = `مراسلة جديدة من ${me.FullName}`;
        const notifMsg = `${subject} (رقم ${number})`;
        const nReq = new sql.Request(tx);
        nReq.input('userId', sql.Int, rcpt.Id);
        nReq.input('corrId', sql.Int, rcptCorrId);
        nReq.input('title', sql.NVarChar(300), notifTitle);
        nReq.input('message', sql.NVarChar(sql.MAX), notifMsg);
        await nReq.query(`
          INSERT INTO Notifications (UserId, CorrespondenceId, Title, Message)
          VALUES (@userId, @corrId, @title, @message)
        `);
        notified.push({ userId: rcpt.Id, corrId: rcptCorrId, fullName: rcpt.FullName });
      }

      if (replyToId) {
        const rReq = new sql.Request(tx);
        rReq.input('now', sql.DateTime2, new Date());
        rReq.input('id', sql.Int, replyToId);
        await rReq.query('UPDATE Correspondences SET RepliedAt = @now WHERE Id = @id');
      }

      await tx.commit();

      for (const n of notified) {
        notifyUser(n.userId, {
          type: 'new-mail',
          correspondenceId: n.corrId,
          number,
          subject,
          fromName: me.FullName,
          priority,
        });
      }
      const message = notified.length > 1
        ? `تم إرسال المراسلة إلى ${notified.length} من المستلمين بنجاح`
        : 'تم إرسال المراسلة بنجاح';
      res.status(201).json({ id: corrId, number, message });
    } catch (txErr) {
      await tx.rollback().catch(() => {});
      throw txErr;
    }
  } catch (err) {
    // Clean up orphan uploaded files on failure
    for (const f of req.files || []) {
      fs.promises.unlink(path.join(UPLOAD_DIR, f.filename)).catch(() => {});
    }
    if (err.message?.startsWith('نوع الملف')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `حجم الملف يتجاوز الحد الأقصى (${MAX_UPLOAD_MB} ميغابايت)` });
    }
    next(err);
  }
});

// POST /api/correspondences/:id/archive  (toggle)
router.post('/:id/archive', async (req, res, next) => {
  try {
    const me = req.user.Id;
    const row = await queryOne(
      'SELECT Id, Status, FromUserId, ToUserId FROM Correspondences WHERE Id = @id',
      { id: parseInt(req.params.id, 10) }
    );
    if (!row) return res.status(404).json({ error: 'المراسلة غير موجودة' });
    if (req.user.Role !== 'admin' && row.FromUserId !== me && row.ToUserId !== me) {
      return res.status(403).json({ error: 'لا تملك صلاحية أرشفة هذه المراسلة' });
    }
    const newStatus = row.Status === 'archived' ? (row.ToUserId === me ? 'read' : 'sent') : 'archived';
    await query('UPDATE Correspondences SET Status = @s WHERE Id = @id', { s: newStatus, id: row.Id });
    res.json({ id: row.Id, status: newStatus, message: newStatus === 'archived' ? 'تم أرشفة المراسلة' : 'تم إرجاع المراسلة من الأرشيف' });
  } catch (err) {
    next(err);
  }
});

// GET /api/attachments/:attId/download
router.get('/attachments/:attId/download', async (req, res, next) => {
  try {
    const me = req.user.Id;
    const att = await queryOne(
      `SELECT a.Id, a.FileName, a.StoredName, a.ContentType,
              c.FromUserId, c.ToUserId
       FROM Attachments a
       JOIN Correspondences c ON c.Id = a.CorrespondenceId
       WHERE a.Id = @id`,
      { id: parseInt(req.params.attId, 10) }
    );
    if (!att) return res.status(404).json({ error: 'المرفق غير موجود' });
    if (req.user.Role !== 'admin' && att.FromUserId !== me && att.ToUserId !== me) {
      return res.status(403).json({ error: 'لا تملك صلاحية تنزيل هذا المرفق' });
    }
    const filePath = path.join(UPLOAD_DIR, att.StoredName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'ملف المرفق غير موجود على الخادم' });
    }
    res.download(filePath, att.FileName);
  } catch (err) {
    next(err);
  }
});

// GET /api/stats
router.get('/meta/stats', async (req, res, next) => {
  try {
    const me = req.user.Id;
    const isAdmin = req.user.Role === 'admin';
    const row = await queryOne(
      `SELECT
        (SELECT COUNT(*) FROM Correspondences c WHERE c.ToUserId = @me AND c.Status <> 'archived') AS totalIncoming,
        (SELECT COUNT(*) FROM Correspondences c WHERE c.FromUserId = @me) AS totalOutgoing,
        (SELECT COUNT(*) FROM Correspondences c WHERE c.ToUserId = @me AND c.Status = 'sent') AS unreadCount,
        (SELECT COUNT(*) FROM Correspondences c WHERE (c.Priority IN ('urgent','high')) AND c.Status <> 'archived' ${isAdmin ? '' : 'AND (c.ToUserId = @me OR c.FromUserId = @me)'}) AS urgentCount,
        (SELECT COUNT(*) FROM Correspondences c WHERE CAST(c.Date AS DATE) = CAST(SYSDATETIME() AS DATE) ${isAdmin ? '' : 'AND (c.ToUserId = @me OR c.FromUserId = @me)'}) AS todayCount,
        (SELECT COUNT(*) FROM Correspondences c WHERE c.Status = 'archived' ${isAdmin ? '' : 'AND (c.ToUserId = @me OR c.FromUserId = @me)'}) AS archivedCount,
        (SELECT COUNT(*) FROM Correspondences c WHERE 1=1 ${isAdmin ? '' : 'AND (c.ToUserId = @me OR c.FromUserId = @me)'}) AS totalCount
      `,
      { me }
    );
    res.json({
      totalIncoming: row.totalIncoming,
      totalOutgoing: row.totalOutgoing,
      unreadCount: row.unreadCount,
      urgentCount: row.urgentCount,
      todayCount: row.todayCount,
      archivedCount: row.archivedCount,
      totalCount: row.totalCount,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
