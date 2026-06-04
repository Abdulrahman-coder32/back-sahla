const cloudinary = require('cloudinary').v2;

const DEFAULT_AVATAR = 'https://res.cloudinary.com/dv48puhaq/image/upload/v1767035882/photo_2025-12-29_21-17-37_irc9se.jpg';

const getProfileImageUrl = (publicId, cacheBuster = 0) => {
  if (!publicId) {
    return DEFAULT_AVATAR;
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
};

module.exports = { getProfileImageUrl, DEFAULT_AVATAR };
