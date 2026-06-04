const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// حماية لو utils مش موجود
let getProfileImageUrl;
try {
  getProfileImageUrl = require('../utils/imageUtils').getProfileImageUrl;
} catch (e) {
  getProfileImageUrl = (img) => img || '';
}

const router = express.Router();

// ========================
// SIGNUP
// ========================
router.post('/signup', async (req, res) => {
  const { email, password, role, ...profile } = req.body;

  // Validation أفضل
  if (!email || !password || !role) {
    return res.status(400).json({ msg: 'بيانات ناقصة: الإيميل، كلمة المرور، ونوع الحساب مطلوبين' });
  }

  if (!profile.governorate || !profile.city) {
    return res.status(400).json({ msg: 'المحافظة والمدينة مطلوبين' });
  }

  if (!profile.name) {
    return res.status(400).json({ msg: 'الاسم مطلوب' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: 'المستخدم موجود بالفعل' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashed,
      role,
      cacheBuster: 0,
      ...profile
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    const imageUrl = getProfileImageUrl(user.profileImage, user.cacheBuster || 0);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profileImage: imageUrl,
        name: user.name,
        phone: user.phone,
        bio: user.bio,
        governorate: user.governorate,
        city: user.city,
        age: user.age,
        work_experience: user.work_experience,
        desired_job_type: user.desired_job_type,
        shop_name: user.shop_name
      }
    });

  } catch (err) {
    console.error('Signup Error Details:', err); // Logging مفصل

    // رسالة خطأ أوضح
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        msg: 'خطأ في البيانات المدخلة',
        details: Object.values(err.errors).map(e => e.message)
      });
    }

    res.status(500).json({ 
      msg: 'حدث خطأ أثناء إنشاء الحساب',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ========================
// LOGIN (بدون تغيير كبير)
// ========================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: 'بيانات ناقصة' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'بيانات غير صحيحة' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ msg: 'بيانات غير صحيحة' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    const imageUrl = getProfileImageUrl(user.profileImage, user.cacheBuster || 0);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profileImage: imageUrl,
        name: user.name,
        phone: user.phone,
        bio: user.bio,
        governorate: user.governorate,
        city: user.city,
        age: user.age,
        work_experience: user.work_experience,
        desired_job_type: user.desired_job_type,
        shop_name: user.shop_name
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
});

module.exports = router;
