import express from 'express';
import { query, queryOne } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();
router.use(authMiddleware);

// GET /api/notifications — latest 30 + unread count
router.get('/', async (req, res, next) => {
  try {
    const me = req.user.Id;
    const result = await query(
      `SELECT TOP 30 Id, CorrespondenceId, ExternalMessageId, Title, Message, IsRead, CreatedAt
       FROM Notifications
       WHERE UserId = @me
       ORDER BY CreatedAt DESC`,
      { me }
    );
    const cnt = await queryOne(
      'SELECT COUNT(*) AS N FROM Notifications WHERE UserId = @me AND IsRead = 0',
      { me }
    );
    res.json({
      unreadCount: cnt?.N || 0,
      notifications: result.recordset.map(n => ({
        id: n.Id,
        correspondenceId: n.CorrespondenceId,
        externalMessageId: n.ExternalMessageId ?? null,
        title: n.Title,
        message: n.Message,
        isRead: !!n.IsRead,
        createdAt: n.CreatedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
router.post('/read-all', async (req, res, next) => {
  try {
    await query('UPDATE Notifications SET IsRead = 1 WHERE UserId = @me AND IsRead = 0', { me: req.user.Id });
    res.json({ message: 'تم تحديد جميع الإشعارات كمقروءة' });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', async (req, res, next) => {
  try {
    await query(
      'UPDATE Notifications SET IsRead = 1 WHERE Id = @id AND UserId = @me',
      { id: parseInt(req.params.id, 10), me: req.user.Id }
    );
    res.json({ message: 'تم' });
  } catch (err) {
    next(err);
  }
});

export default router;
