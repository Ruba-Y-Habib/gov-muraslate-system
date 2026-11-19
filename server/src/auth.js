import jwt from 'jsonwebtoken';
import { queryOne } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const TOKEN_HOURS = parseInt(process.env.TOKEN_HOURS || '12', 10);

export function signToken(user) {
  return jwt.sign(
    { sub: user.Id, role: user.Role, name: user.FullName },
    JWT_SECRET,
    { expiresIn: `${TOKEN_HOURS}h` }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'انتهت صلاحية الجلسة - يرجى تسجيل الدخول من جديد' });
  }
  try {
    const user = await queryOne(
      `SELECT u.Id, u.FullName, u.Username, u.Role, u.DepartmentId, u.IsActive, u.ExternalEntityId,
              d.Name AS DepartmentName, ee.Name AS ExternalEntityName
       FROM Users u
       LEFT JOIN Departments d ON d.Id = u.DepartmentId
       LEFT JOIN ExternalEntities ee ON ee.Id = u.ExternalEntityId
       WHERE u.Id = @id`,
      { id: payload.sub }
    );
    if (!user || !user.IsActive) {
      return res.status(401).json({ error: 'الحساب غير موجود أو معطل' });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.Role !== 'admin') {
    return res.status(403).json({ error: 'هذه العملية تتطلب صلاحيات مدير النظام' });
  }
  next();
}
