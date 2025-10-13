const mongoose = require('mongoose');

const RecordingSchema = new mongoose.Schema({
  transcription: { type: String, required: true },
  summary: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Recording', RecordingSchema);