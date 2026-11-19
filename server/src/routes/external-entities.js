import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, queryOne } from '../db.js';
import { authMiddleware, requireAdmin } from '../auth.js';

const router = express.Router();

// الجهات الخارجية — العرض لكل المخوّلين بالشاشة، والتعديل للأدمن والمدير
router.use(authMiddleware);

const canSee = (req) => ['admin', 'director', 'dept_head'].includes(req.user.Role);
const canManage = (req) => req.user.Role === 'admin' || req.user.Role === 'director';
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,50}$/;

// GET /api/external-entities — قائمة الجهات (النشطة للجميع المخوّل، والكل للأدمن مع ?all=1)
router.get('/', async (req, res, next) => {
  try {
    if (!canSee(req)) return res.status(403).json({ error: 'هذه القائمة متاحة لموظفي المديرية المخوّلين فقط' });
    const rows = await query(
      req.query.all === '1' && req.user.Role === 'admin'
        ? `SELECT e.Id, e.Name, e.SectionName, e.ContactInfo, e.IsActive, e.CreatedAt, a.Username AS AccountUsername, a.IsActive AS AccountActive
           FROM ExternalEntities e
           LEFT JOIN Users a ON a.ExternalEntityId = e.Id AND a.Role = 'external'
           ORDER BY e.Name`
        : `SELECT e.Id, e.Name, e.SectionName, e.ContactInfo, e.IsActive, e.CreatedAt, a.Username AS AccountUsername, a.IsActive AS AccountActive
           FROM ExternalEntities e
           LEFT JOIN Users a ON a.ExternalEntityId = e.Id AND a.Role = 'external'
           WHERE e.IsActive = 1 ORDER BY e.Name`
    );
    res.json(rows.recordset.map(e => ({
      id: e.Id,
      name: e.Name,
      sectionName: e.SectionName || '',
      contactInfo: e.ContactInfo || '',
      isActive: !!e.IsActive,
      createdAt: e.CreatedAt,
      accountUsername: e.AccountUsername || null,
      accountActive: e.AccountActive == null ? null : !!e.AccountActive,
    })));
  } catch (err) { next(err); }
});

// POST /api/external-entities — إضافة جهة + إنشاء حساب نظامي لها تلقائياً
router.post('/', async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'لا تملك صلاحية إضافة جهة خارجية' });
    const { name, sectionName, contactInfo, username, password } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'اسم المديرية الخارجية مطلوب' });
    }
    const clean = String(name).trim();
    const dupe = await queryOne('SELECT Id FROM ExternalEntities WHERE Name = @name AND IsActive = 1', { name: clean });
    if (dupe) return res.status(409).json({ error: `الجهة «${clean}» موجودة مسبقاً` });

    let accountUsername = String(username || '').trim();
    if (accountUsername && !USERNAME_RE.test(accountUsername)) {
      return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون بأحرف إنكليزية وأرقام (3 أحرف على الأقل) دون فراغات' });
    }
    const plainPassword = String(password || '').trim() || crypto.randomBytes(4).toString('hex');
    if (plainPassword.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف أو أكثر' });
    }
    const r = await query(
      'INSERT INTO ExternalEntities (Name, SectionName, ContactInfo) OUTPUT INSERTED.Id VALUES (@name, @section, @contact)',
      { name: clean, section: (sectionName || '').trim() || null, contact: (contactInfo || '').trim() || null }
    );
    const entityId = r.recordset[0].Id;
    if (!accountUsername) accountUsername = `entity${entityId}`;
    if (!USERNAME_RE.test(accountUsername)) accountUsername = `entity${entityId}`;
    const taken = await queryOne('SELECT Id FROM Users WHERE Username = @u', { u: accountUsername });
    if (taken) return res.status(409).json({ error: `اسم المستخدم «${accountUsername}» مستخدم مسبقاً — عدّل الجهة وحدد اسماً آخر أو احذفها وأعدها` });

    const hash = await bcrypt.hash(plainPassword, 10);
    await query(
      `INSERT INTO Users (FullName, Username, PasswordHash, Role, DepartmentId, ExternalEntityId, IsActive)
       VALUES (@fullName, @u, @hash, 'external', NULL, @eid, 1)`,
      { fullName: clean, u: accountUsername, hash, eid: entityId }
    );

    res.status(201).json({
      id: entityId,
      name: clean,
      accountUsername,
      password: plainPassword,
      message: `تمت إضافة الجهة «${clean}» بنجاح مع حساب نظامي — اسم المستخدم: ${accountUsername} وكلمة المرور: ${plainPassword} (احفظها الآن — لن تظهر مرة أخرى)`,
    });
  } catch (err) { next(err); }
});

// PUT /api/external-entities/:id — تعديل جهة (أدمن فقط) مع مزامنة حسابها
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const entity = await queryOne('SELECT Id FROM ExternalEntities WHERE Id = @id', { id });
    if (!entity) return res.status(404).json({ error: 'الجهة الخارجية غير موجودة' });
    const { name, sectionName, contactInfo, isActive, newPassword } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'اسم المديرية الخارجية مطلوب' });
    }
    const clean = String(name).trim();
    const dupe = await queryOne('SELECT Id FROM ExternalEntities WHERE Name = @name AND IsActive = 1 AND Id <> @id', { name: clean, id });
    if (dupe) return res.status(409).json({ error: `الجهة «${clean}» موجودة مسبقاً` });
    const active = !(isActive === false || isActive === 0);
    await query(
      'UPDATE ExternalEntities SET Name = @name, SectionName = @section, ContactInfo = @contact, IsActive = @active WHERE Id = @id',
      {
        name: clean,
        section: (sectionName || '').trim() || null,
        contact: (contactInfo || '').trim() || null,
        active,
        id,
      }
    );
    // مزامنة الحساب النظامي للجهة
    const account = await queryOne(`SELECT Id, Username FROM Users WHERE ExternalEntityId = @eid AND Role = 'external'`, { eid: id });
    if (account) {
      if (newPassword && String(newPassword).trim()) {
        const np = String(newPassword).trim();
        if (np.length < 6) return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف أو أكثر' });
        const hash = await bcrypt.hash(np, 10);
        await query('UPDATE Users SET PasswordHash = @hash, IsActive = @active, FullName = @name WHERE Id = @uid',
          { hash, active: active ? 1 : 0, name: clean, uid: account.Id });
        return res.json({ id, message: `تم تعديل بيانات الجهة وتحديث كلمة مرور حسابها (${account.Username}) بنجاح` });
      }
      await query('UPDATE Users SET IsActive = @active, FullName = @name WHERE Id = @uid',
        { active: active ? 1 : 0, name: clean, uid: account.Id });
    }
    res.json({ id, message: 'تم تعديل بيانات الجهة بنجاح' });
  } catch (err) { next(err); }
});

// POST /api/external-entities/:id/reset-password — إعادة تعيين كلمة مرور حساب الجهة (أدمن)
router.post('/:id/reset-password', requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const account = await queryOne(`SELECT Id, Username FROM Users WHERE ExternalEntityId = @eid AND Role = 'external'`, { eid: id });
    if (!account) return res.status(404).json({ error: 'لا يوجد حساب نظامي مرتبط بهذه الجهة' });
    const plain = String(req.body?.password || '').trim() || crypto.randomBytes(4).toString('hex');
    if (plain.length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف أو أكثر' });
    const hash = await bcrypt.hash(plain, 10);
    await query('UPDATE Users SET PasswordHash = @hash WHERE Id = @uid', { hash, uid: account.Id });
    res.json({ username: account.Username, password: plain, message: `كلمة مرور جديدة للحساب ${account.Username}: ${plain} (احفظها الآن — لن تظهر مرة أخرى)` });
  } catch (err) { next(err); }
});

// DELETE /api/external-entities/:id — حذف/تعطيل جهة (أدمن فقط)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const entity = await queryOne('SELECT Id, Name FROM ExternalEntities WHERE Id = @id AND IsActive = 1', { id });
    if (!entity) return res.status(404).json({ error: 'الجهة الخارجية غير موجودة' });
    const used = await queryOne('SELECT COUNT(*) AS N FROM ExternalMessages WHERE EntityId = @id', { id });
    if ((used?.N || 0) > 0) {
      // جهة لها رسائل: تُعطَّل فقط حفاظاً على الأرشيف، ويُعطَّل حسابها
      await query('UPDATE ExternalEntities SET IsActive = 0 WHERE Id = @id', { id });
      await query(`UPDATE Users SET IsActive = 0 WHERE ExternalEntityId = @eid AND Role = 'external'`, { eid: id });
      return res.json({ id, message: `تم تعطيل الجهة «${entity.Name}» وحسابها — رسائلها محفوظة في الأرشيف` });
    }
    await query(`DELETE FROM Users WHERE ExternalEntityId = @eid AND Role = 'external'`, { eid: id });
    await query('DELETE FROM ExternalEntities WHERE Id = @id', { id });
    res.json({ id, message: `تم حذف الجهة «${entity.Name}» وحسابها بنجاح` });
  } catch (err) { next(err); }
});

export default router;
