const cloudinary = require('cloudinary').v2;

// fallback صورة افتراضية
const DEFAULT_AVATAR =
  'https://res.cloudinary.com/dv48puhaq/image/upload/v1767035882/photo_2025-12-29_21-17-37_irc9se.jpg';

// نحاول نعمل config لو موجود env
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const getProfileImageUrl = (publicId, cacheBuster = 0) => {
  try {
    if (!publicId) return DEFAULT_AVATAR;

    // لو Cloudinary مش متظبط، رجع الصورة كما هي
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return publicId;
    }

    const url = cloudinary.url(publicId, {
      secure: true,
      quality: 'auto',
      fetch_format: 'auto',
      width: 400,
      height: 400,
      crop: 'fill',
      gravity: 'face',
      radius: 'max',
    });

    return `${url}?v=${cacheBuster}`;
  } catch (err) {
    console.error('Cloudinary Error:', err);
    return DEFAULT_AVATAR;
  }
};

module.exports = { getProfileImageUrl, DEFAULT_AVATAR };
