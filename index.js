require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const sequelize = require('./src/config/database'); // FIXED
const authRoutes = require('./src/routes/auth');
const uploadRoutes = require('./src/routes/upload');
const aiRoutes = require('./src/routes/ai');

const app = express();

// CORS with credentials
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Ensure tmp directory exists
const tmpDir = path.join(__dirname, 'tmp');
require('fs').mkdirSync(tmpDir, { recursive: true });

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('✅ Database connected and synced');
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ DB connection failed:', err);
    process.exit(1);
  }
})();
