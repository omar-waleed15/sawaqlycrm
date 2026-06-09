"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const comments_1 = __importDefault(require("./routes/comments"));
const attachments_1 = __importDefault(require("./routes/attachments"));
const clients_1 = __importDefault(require("./routes/clients"));
const projects_1 = __importDefault(require("./routes/projects"));
const contracts_1 = __importDefault(require("./routes/contracts"));
const content_ideas_1 = __importDefault(require("./routes/content_ideas"));
const expenses_1 = __importDefault(require("./routes/expenses"));
const salaries_1 = __importDefault(require("./routes/salaries"));
const finance_analytics_1 = __importDefault(require("./routes/finance_analytics"));
const sales_1 = __importDefault(require("./routes/sales"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Middleware
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow any origin to support both localhost and vercel.app deployments
        callback(null, true);
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/users', users_1.default);
app.use('/api/tasks', tasks_1.default);
app.use('/api/tasks/:taskId/comments', comments_1.default);
app.use('/api/tasks/:taskId/attachments', attachments_1.default);
app.use('/api/clients', clients_1.default);
app.use('/api/projects', projects_1.default);
app.use('/api/contracts', contracts_1.default);
app.use('/api/ideas', content_ideas_1.default);
app.use('/api/expenses', expenses_1.default);
app.use('/api/salaries', salaries_1.default);
app.use('/api/finance-analytics', finance_analytics_1.default);
app.use('/api/sales', sales_1.default);
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
app.listen(PORT, () => {
    console.log(`🚀 Sawaqly CRM Server running on http://localhost:${PORT}`);
});
exports.default = app;
