const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Groq = require('groq-sdk');

const router = express.Router();

router.post('/ask', requireAuth, async (req, res) => {
  try {
    const { question, context = '', answerType = 'explanation' } = req.body || {};
    if (!question || !question.trim()) {
      return res.status(400).json({ message: 'Question is required' });
    }

    const systemPrompt = `You are an expert educational assistant specializing in programming and web development. Your knowledge base includes W3Schools, GeeksforGeeks, and Tutorialspoint. Provide clear, concise, and accurate answers suitable for learners.`;

    const userPrompt = `Question: ${question}\n\nContext: ${context}\n\nAnswer Type: ${answerType}\n\nProvide a comprehensive answer with practical examples when applicable.`;

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    if (!completion.choices || !completion.choices[0]) {
      return res.status(500).json({ message: 'Groq error', details: completion });
    }

    const answer = completion.choices[0].message.content;
    res.json({ data: { answer } });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ message: 'Failed to generate answer' });
  }
});

router.get('/history', requireAuth, async (req, res) => {
  // Placeholder: return empty history
  res.json({ data: { history: [] } });
});

module.exports = router;