const express = require('express');
const multer = require('multer');
// Remove static require for pdf-parse; use dynamic ESM import instead
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Ensure tmp directory exists
const tmpDir = path.join(__dirname, '../../tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const upload = multer({
  dest: tmpDir,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype || '';
    const ext = path.extname(file.originalname).toLowerCase();
    if (mime === 'application/pdf' || ext === '.pdf' || mime.startsWith('image/') || ['.png', '.jpg', '.jpeg'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  }
});

// Multer error-handling wrapper to return cleaner errors
const uploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large', limit: '15MB' });
      }
      if (err.message === 'Unsupported file type') {
        return res.status(400).json({ message: 'Unsupported file type' });
      }
      return res.status(500).json({ message: 'Upload failed', details: err.message });
    }
    next();
  });
};

// Helper to dynamically load pdf-parse under CommonJS
let cachedPdfParse = null;
async function getPdfParse() {
  if (cachedPdfParse) return cachedPdfParse;
  const mod = await import('pdf-parse');
  const fn = mod && (mod.default || mod);
  cachedPdfParse = fn;
  return cachedPdfParse;
}

router.post('/file', requireAuth, uploadMiddleware, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const filePath = req.file.path;
    const mime = req.file.mimetype || '';
    const ext = path.extname(req.file.originalname).toLowerCase();

    let extractedText = '';

    if (mime === 'application/pdf' || ext === '.pdf') {
      try {
        const parsePdf = await getPdfParse();
        if (typeof parsePdf !== 'function') {
          return res.status(500).json({ message: 'PDF parser not initialized', details: 'pdf-parse did not resolve to a function' });
        }
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await parsePdf(dataBuffer);
        extractedText = (pdfData.text || '').trim();
      } catch (e) {
        console.error('PDF parse error:', e);
        return res.status(400).json({ message: 'Failed to parse PDF', details: e.message });
      }
    } else if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg'].includes(ext)) {
      try {
        const result = await Tesseract.recognize(filePath, 'eng', {
          // Prefer local traineddata if present
          langPath: path.join(process.cwd()),
        });
        extractedText = (result.data.text || '').trim();
      } catch (e) {
        console.error('OCR error:', e);
        return res.status(400).json({ message: 'Failed to perform OCR', details: e.message });
      }
    } else {
      return res.status(400).json({ message: 'Unsupported file type', details: `mime=${mime} ext=${ext}` });
    }

    // Cleanup temp file
    try {
      fs.unlink(filePath, () => {});
    } catch (_) {}

    if (!extractedText) {
      return res.status(200).json({ data: { extractedText: '' }, note: 'No text extracted' });
    }

    res.json({ data: { extractedText } });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Failed to process file', details: err.message });
  }
});

router.post('/text', requireAuth, async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ message: 'Text is required' });
  res.json({ data: { text } });
});

module.exports = router;