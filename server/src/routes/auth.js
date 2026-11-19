import express from 'express';
import bcrypt from 'bcryptjs';
import { queryOne } from '../db.js';
import { signToken, authMiddleware } from '../auth.js';

const router = express.Router();

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    id: req.user.Id,
    fullName: req.user.FullName,
    username: req.user.Username,
    role: req.user.Role,
    departmentId: req.user.DepartmentId,
    departmentName: req.user.DepartmentName,
    externalEntityId: req.user.ExternalEntityId ?? null,
    externalEntityName: req.user.ExternalEntityName ?? null,
  });
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    if (!username || !password) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }
    const user = await queryOne(
      `SELECT u.Id, u.FullName, u.Username, u.PasswordHash, u.Role, u.DepartmentId, u.IsActive, u.ExternalEntityId,
              d.Name AS DepartmentName, ee.Name AS ExternalEntityName
       FROM Users u
       LEFT JOIN Departments d ON d.Id = u.DepartmentId
       LEFT JOIN ExternalEntities ee ON ee.Id = u.ExternalEntityId
       WHERE u.Username = @username`,
      { username }
    );
    if (!user || !user.IsActive) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.Id,
        fullName: user.FullName,
        username: user.Username,
        role: user.Role,
        departmentId: user.DepartmentId,
        departmentName: user.DepartmentName,
        externalEntityId: user.ExternalEntityId ?? null,
        externalEntityName: user.ExternalEntityName ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
