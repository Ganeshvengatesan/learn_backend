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

// CORS with credentials - support multiple origins
const allowedOrigins = [
  // Local development
  'http://localhost:5173',
  'http://localhost:3000',
  
  // Production frontend
  'https://learnaiassist.netlify.app',
  
  // Cloudflare Workers
  'https://education.learnwise-ai.workers.dev',
  
  // Render backend (if needed for direct API access)
  'https://learn-backend-y751.onrender.com',
  
  // Fallback from environment variable
  process.env.CORS_ORIGIN
].filter(Boolean); // Remove any undefined values

// CORS middleware with preflight continue
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  } else if (origin) {
    console.warn('⚠️ CORS blocked origin:', origin);
  }
  next();
});

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
