import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initSocket } from './socket.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import departmentsRoutes from './routes/departments.js';
import correspondencesRoutes from './routes/correspondences.js';
import notificationsRoutes from './routes/notifications.js';
import externalEntitiesRoutes from './routes/external-entities.js';
import externalRoutes from './routes/external.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4000', 10);

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '2mb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/correspondences', correspondencesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/external-entities', externalEntitiesRoutes);
app.use('/api/external', externalRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'نظام المراسلات الداخلية', time: new Date().toISOString() });
});

// Static frontend (built client)
const distDir = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api|\/socket\.io).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message || err);
  if (res.headersSent) return next(err);
  res.status(err.statusCode || 500).json({
    error: err.sqlMessage || err.message || 'حدث خطأ غير متوقع في الخادم',
  });
});

initSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log('================================================');
  console.log('  نظام المراسلات الداخلية - مديرية مالية اللاذقية');
  console.log(`  يعمل الآن على المنفذ: ${PORT}`);
  console.log(`  http://localhost:${PORT}`);
  console.log('================================================');
});
