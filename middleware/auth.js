const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ msg: 'لا يوجد توكن' });
  }

  try {
    // لو التوكن جاي بصيغة Bearer
    const realToken = token.replace('Bearer ', '');

    const decoded = jwt.verify(realToken, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role
    };

    next();
  } catch (err) {
    return res.status(401).json({ msg: 'توكن غير صالح' });
  }
};
