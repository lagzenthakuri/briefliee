const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const Recording = require('./models/Recording');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/briefly';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Mongo connect error', err);
});

app.post('/api/recordings', async (req, res) => {
  try {
    const { transcription, summary } = req.body;

    if (!transcription || !summary) {
      return res.status(400).json({ error: 'transcription and summary are required' });
    }

    const doc = await Recording.create({
      transcription,
      summary,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('Failed to save recording:', err);
    res.status(500).json({ error: 'Failed to save recording' });
  }
});

// New: GET history
app.get('/api/recordings', async (req, res) => {
  try {
    const docs = await Recording.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(docs);
  } catch (err) {
    console.error('Failed to fetch recordings:', err);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));