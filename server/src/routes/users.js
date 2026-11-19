import express from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../db.js';
import { authMiddleware, requireAdmin } from '../auth.js';

const router = express.Router();

const ROLES = ['admin', 'director', 'dept_head'];

// GET /api/users  — admin: all users; others: active users (for compose/contacts)
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.Role === 'admin') {
      const result = await query(
        `SELECT u.Id, u.FullName, u.Username, u.Role, u.DepartmentId, u.IsActive, u.CreatedAt,
                d.Name AS DepartmentName
         FROM Users u
         LEFT JOIN Departments d ON d.Id = u.DepartmentId
         ORDER BY u.Role, u.FullName`
      );
      return res.json(result.recordset.map(u => ({
        id: u.Id,
        fullName: u.FullName,
        username: u.Username,
        role: u.Role,
        departmentId: u.DepartmentId,
        departmentName: u.DepartmentName,
        isActive: !!u.IsActive,
        createdAt: u.CreatedAt,
      })));
    }
    const result = await query(
      `SELECT u.Id, u.FullName, u.Role, u.DepartmentId, d.Name AS DepartmentName
       FROM Users u
       LEFT JOIN Departments d ON d.Id = u.DepartmentId
       WHERE u.IsActive = 1
       ORDER BY CASE u.Role WHEN 'director' THEN 0 ELSE 1 END, u.FullName`
    );
    res.json(result.recordset.map(u => ({
      id: u.Id,
      fullName: u.FullName,
      role: u.Role,
      departmentId: u.DepartmentId,
      departmentName: u.DepartmentName,
    })));
  } catch (err) {
    next(err);
  }
});

// POST /api/users  (admin)
router.post('/', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const fullName = (req.body.fullName || '').trim();
    const username = (req.body.username || '').trim().toLowerCase();
    const password = req.body.password || '';
    const role = req.body.role;
    const departmentId = req.body.departmentId ? parseInt(req.body.departmentId, 10) : null;

    if (!fullName) return res.status(400).json({ error: 'يرجى إدخال الاسم الكامل' });
    if (!username) return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم' });
    if (password.length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'الدور غير صحيح' });
    if (role === 'dept_head' && !departmentId) {
      return res.status(400).json({ error: 'يجب تحديد القسم لرئيس القسم' });
    }

    const exists = await queryOne('SELECT Id FROM Users WHERE Username = @username', { username });
    if (exists) return res.status(400).json({ error: 'اسم المستخدم مستخدم مسبقاً' });

    if (departmentId) {
      const dept = await queryOne('SELECT Id FROM Departments WHERE Id = @id', { id: departmentId });
      if (!dept) return res.status(400).json({ error: 'القسم غير موجود' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO Users (FullName, Username, PasswordHash, Role, DepartmentId, IsActive)
       OUTPUT INSERTED.Id
       VALUES (@fullName, @username, @hash, @role, @departmentId, 1)`,
      { fullName, username, hash, role, departmentId }
    );
    res.status(201).json({ id: result.recordset[0].Id, message: 'تم إنشاء المستخدم بنجاح' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id  (admin)
router.put('/:id', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await queryOne('SELECT Id, Role FROM Users WHERE Id = @id', { id });
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const fullName = req.body.fullName !== undefined ? String(req.body.fullName).trim() : undefined;
    const role = req.body.role !== undefined ? req.body.role : undefined;
    const departmentId = req.body.departmentId !== undefined
      ? (req.body.departmentId ? parseInt(req.body.departmentId, 10) : null)
      : undefined;
    const isActive = req.body.isActive !== undefined ? (req.body.isActive ? 1 : 0) : undefined;
    const password = req.body.password || '';

    if (role !== undefined && !ROLES.includes(role)) {
      return res.status(400).json({ error: 'الدور غير صحيح' });
    }
    // Self-protection: an admin cannot demote or deactivate their own account
    if (id === req.user.Id && role !== undefined && role !== 'admin') {
      return res.status(400).json({ error: 'لا يمكن تغيير دور حسابك الإداري' });
    }
    if (id === req.user.Id && isActive === 0) {
      return res.status(400).json({ error: 'لا يمكن تعطيل حسابك الإداري' });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    const hash = password ? await bcrypt.hash(password, 10) : null;

    const sets = [];
    const params = { id };
    if (fullName !== undefined && fullName) { sets.push('FullName = @fullName'); params.fullName = fullName; }
    if (role !== undefined) { sets.push('Role = @role'); params.role = role; }
    if (departmentId !== undefined) { sets.push('DepartmentId = @departmentId'); params.departmentId = departmentId; }
    if (isActive !== undefined) { sets.push('IsActive = @isActive'); params.isActive = isActive; }
    if (hash) { sets.push('PasswordHash = @hash'); params.hash = hash; }
    if (sets.length === 0) return res.status(400).json({ error: 'لا توجد تغييرات' });

    await query(`UPDATE Users SET ${sets.join(', ')} WHERE Id = @id`, params);
    res.json({ message: password ? 'تم تحديث بيانات المستخدم وكلمة المرور' : 'تم تحديث بيانات المستخدم' });
  } catch (err) {
    next(err);
  }
});

export default router;
