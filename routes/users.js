const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { getProfileImageUrl } = require('../utils/imageUtils');

const router = express.Router();

// تكوين Cloudinary (من .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// تكوين Multer (في الذاكرة)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|jpg|png|gif|webp)/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم، يجب أن تكون صورة'));
    }
  },
});

// GET /me - جلب البروفايل
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'المستخدم غير موجود' });

    const imageUrl = getProfileImageUrl(user.profileImage, user.cacheBuster);
    res.json({
      ...user.toObject(),
      profileImage: imageUrl,
    });
  } catch (err) {
    console.error('خطأ جلب البروفايل:', err);
    res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
});

// PUT /profile - تحديث البروفايل
router.put('/profile', auth, upload.single('profileImage'), async (req, res) => {
  try {
    const { name, phone, bio } = req.body;
    const updates = {};
    let cacheBusterIncremented = false;

    // تحديث الحقول النصية
    if (name !== undefined && name.trim()) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone?.trim();
    if (bio !== undefined) updates.bio = bio?.trim() || '';

    // التعامل مع الصورة
    if (req.file) {
      // إضافة timestamp للـ public_id عشان نضمن صورة جديدة تمامًا كل مرة
      const timestamp = Date.now();
      const publicId = `user_${req.user.id}_${timestamp}`;

      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'sahla-profiles',
            public_id: publicId,
            resource_type: 'image',
            quality: 'auto',
            fetch_format: 'auto',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });

      updates.profileImage = result.public_id;
      updates.$inc = { cacheBuster: 1 };
      cacheBusterIncremented = true;
    }
    // حذف الصورة
    else if (req.body.profileImage === '' || req.body.profileImage === 'null') {
      updates.profileImage = null;
      updates.cacheBuster = 0;
      cacheBusterIncremented = true;
    }

    // لو مفيش تغييرات
    if (Object.keys(updates).length === 0 && !cacheBusterIncremented) {
      return res.status(400).json({ msg: 'لا توجد تغييرات لحفظها' });
    }

    // تحديث في الداتابيز
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }

    // توليد URL مع cache buster
    const imageUrl = getProfileImageUrl(updatedUser.profileImage, updatedUser.cacheBuster);

    const responseUser = {
      ...updatedUser.toObject(),
      profileImage: imageUrl,
    };

    res.json(responseUser);

    // إرسال تحديث real-time لو اتغيرت الصورة
    if (cacheBusterIncremented) {
      const io = req.app.get('io');
      if (io) {
        io.to(req.user.id.toString()).emit('profileUpdated', {
          userId: req.user.id,
          profileImage: imageUrl,
          cacheBuster: updatedUser.cacheBuster,
        });
      }
    }
  } catch (err) {
    console.error('خطأ تحديث البروفايل:', err);
    res.status(500).json({ msg: 'فشل حفظ التغييرات، حاول مرة أخرى' });
  }
});

module.exports = router;
