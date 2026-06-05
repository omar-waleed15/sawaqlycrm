import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import taskRoutes from './routes/tasks';
import commentRoutes from './routes/comments';
import attachmentRoutes from './routes/attachments';
import clientRoutes from './routes/clients';
import projectRoutes from './routes/projects';
import contractRoutes from './routes/contracts';
import contentIdeasRoutes from './routes/content_ideas';
import expensesRoutes from './routes/expenses';
import salariesRoutes from './routes/salaries';
import analyticsRoutes from './routes/finance_analytics';
import salesRoutes from './routes/sales';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin to support both localhost and vercel.app deployments
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tasks/:taskId/comments', commentRoutes);
app.use('/api/tasks/:taskId/attachments', attachmentRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/ideas', contentIdeasRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/salaries', salariesRoutes);
app.use('/api/finance-analytics', analyticsRoutes);
app.use('/api/sales', salesRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Sawaqly CRM Server running on http://localhost:${PORT}`);
});

export default app;
