// backend/models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, default: '' }, // ممكن يكون فارغ لو الرسالة ملف
  type: { type: String, enum: ['text', 'image', 'audio', 'file'], default: 'text' },
  filename: { type: String }, // اسم الملف الأصلي
  url: { type: String },      // رابط أو مسار الملف
  size: { type: Number },     // حجم الملف بالبايت
  timestamp: { type: Date, default: Date.now }
});

// Index لتحسين أداء جلب الرسائل حسب الـ application
messageSchema.index({ application_id: 1 });

module.exports = mongoose.model('Message', messageSchema);
