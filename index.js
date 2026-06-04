const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const path = require('path');

const Message = require('./models/Message');
const Application = require('./models/Application');
const Notification = require('./models/Notification');

dotenv.config();

// التحقق من وجود MONGO_URI
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI مش موجود في الـ Environment Variables!");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

app.set('io', io);

// ───────────── MIDDLEWARES ─────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS Configuration
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Logging للطلبات
app.use((req, res, next) => {
  console.log(`📌 ${req.method} ${req.url} | Origin: ${req.headers.origin}`);
  next();
});

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ───────────── ROUTES ─────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));

// Test Route
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend شغال تمام ✅',
    client_url: process.env.CLIENT_URL || 'غير محدد'
  });
});

// ───────────── SOCKET AUTH & LOGIC ─────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('لا يوجد توكن'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    next(new Error('توكن غير صالح'));
  }
});

io.on('connection', (socket) => {
  console.log('مستخدم متصل:', socket.user?.id);
  if (socket.user?.id) {
    socket.join(socket.user.id.toString());
  }

  socket.on('joinChat', (applicationId) => {
    socket.join(applicationId);
  });

  socket.on('sendMessage', async ({ application_id, message }) => {
    if (!message?.trim()) return;
    try {
      const newMessage = new Message({
        application_id,
        sender_id: socket.user.id,
        message: message.trim(),
        timestamp: new Date()
      });
      await newMessage.save();

      const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender_id', 'name');

      io.to(application_id).emit('newMessage', populatedMessage);

      const appData = await Application.findById(application_id)
        .populate('job_id', 'owner_id')
        .populate('seeker_id', 'name');

      if (!appData) return;

      const recipientIsSeeker = socket.user.id === appData.job_id.owner_id.toString();
      const recipientId = recipientIsSeeker
        ? appData.seeker_id._id.toString()
        : appData.job_id.owner_id.toString();

      const recipientField = recipientIsSeeker ? 'unreadCounts.seeker' : 'unreadCounts.owner';

      await Application.findByIdAndUpdate(application_id, {
        lastMessage: message.trim(),
        lastTimestamp: new Date(),
        $inc: { [recipientField]: 1 }
      });

      const currentUnread = appData.unreadCounts?.[recipientIsSeeker ? 'seeker' : 'owner'] || 0;
      io.to(recipientId).emit('unreadUpdate', {
        application_id,
        unreadCount: currentUnread + 1
      });

      const notificationData = {
        type: 'new_message',
        message: `لديك رسالة جديدة من ${populatedMessage.sender_id.name}`,
        application_id,
        read: false,
        createdAt: new Date()
      };

      await new Notification({
        user_id: recipientId,
        ...notificationData
      }).save();

      io.to(recipientId).emit('newNotification', notificationData);
    } catch (err) {
      console.error('❌ Socket Error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('مستخدم انفصل:', socket.user?.id);
  });
});

// ───────────── DB + SERVER START ─────────────
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });

    console.log('✅ MongoDB اتوصل بنجاح يا معلم');

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 السيرفر شغال على بورت ${PORT}`);
      console.log(`🌐 Client URL المسموح: ${process.env.CLIENT_URL || 'كله مسموح'}`);
    });

  } catch (err) {
    console.error('❌ فشل في الاتصال بالمونجو:', err.message);
    process.exit(1);
  }
};

// شغل السيرفر
startServer();
