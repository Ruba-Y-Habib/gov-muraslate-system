import express from 'express';
import { query, queryOne } from '../db.js';
import { authMiddleware, requireAdmin } from '../auth.js';

const router = express.Router();

// GET /api/departments — with the head user id (for composing to a department head)
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT d.Id, d.Name, d.HeadName, d.HeadTitle, d.Phone, d.Email, d.Office,
              u.Id AS HeadUserId
       FROM Departments d
       LEFT JOIN Users u ON u.DepartmentId = d.Id AND u.Role = 'dept_head' AND u.IsActive = 1
       WHERE d.IsActive = 1
       ORDER BY d.Id`
    );
    res.json(result.recordset.map(d => ({
      id: d.Id,
      name: d.Name,
      headName: d.HeadName,
      headTitle: d.HeadTitle,
      phone: d.Phone || '',
      email: d.Email || '',
      office: d.Office || '',
      headUserId: d.HeadUserId || null,
    })));
  } catch (err) {
    next(err);
  }
});

function parseDeptBody(body) {
  const name = (body?.name || '').trim();
  if (!name) return { error: 'يرجى إدخال اسم القسم' };
  return {
    data: {
      name,
      headName: (body.headName || '').trim() || null,
      headTitle: (body.headTitle || '').trim() || null,
      phone: (body.phone || '').trim() || null,
      email: (body.email || '').trim() || null,
      office: (body.office || '').trim() || null,
    },
  };
}

// POST /api/departments — add a department (admin only)
router.post('/', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const parsed = parseDeptBody(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const d = parsed.data;
    const dup = await queryOne(
      'SELECT Id FROM Departments WHERE Name = @name',
      { name: d.name }
    );
    if (dup) return res.status(409).json({ error: 'يوجد قسم بنفس الاسم (نشط أو محذوف سابقاً)' });
    const ins = await query(
      `INSERT INTO Departments (Name, HeadName, HeadTitle, Phone, Email, Office, IsActive)
       OUTPUT INSERTED.Id
       VALUES (@name, @headName, @headTitle, @phone, @email, @office, 1)`,
      d
    );
    res.status(201).json({ id: ins.recordset[0].Id, message: 'تمت إضافة القسم بنجاح' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/departments/:id — edit a department (admin only)
router.put('/:id', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const dept = await queryOne('SELECT Id FROM Departments WHERE Id = @id AND IsActive = 1', { id });
    if (!dept) return res.status(404).json({ error: 'القسم غير موجود' });
    const parsed = parseDeptBody(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const d = parsed.data;
    const dup = await queryOne(
      'SELECT Id FROM Departments WHERE Name = @name AND Id <> @id',
      { name: d.name, id }
    );
    if (dup) return res.status(409).json({ error: 'يوجد قسم آخر بنفس الاسم' });
    await query(
      `UPDATE Departments
       SET Name = @name, HeadName = @headName, HeadTitle = @headTitle,
           Phone = @phone, Email = @email, Office = @office
       WHERE Id = @id`,
      { ...d, id }
    );
    res.json({ id, message: 'تم تعديل بيانات القسم بنجاح' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/departments/:id — deactivate a department (admin only)
router.delete('/:id', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const dept = await queryOne('SELECT Id, Name FROM Departments WHERE Id = @id AND IsActive = 1', { id });
    if (!dept) return res.status(404).json({ error: 'القسم غير موجود' });
    const members = await queryOne(
      'SELECT COUNT(*) AS N FROM Users WHERE DepartmentId = @id AND IsActive = 1',
      { id }
    );
    if ((members?.N || 0) > 0) {
      return res.status(409).json({
        error: `لا يمكن حذف القسم لوجود ${(members?.N || 0)} مستخدم نشط منتمٍ إليه — انقل المستخدمين إلى قسم آخر أو عطّل حساباتهم أولاً`,
      });
    }
    await query('UPDATE Departments SET IsActive = 0 WHERE Id = @id', { id });
    res.json({ id, message: `تم حذف القسم «${dept.Name}» بنجاح` });
  } catch (err) {
    next(err);
  }
});

export default router;
