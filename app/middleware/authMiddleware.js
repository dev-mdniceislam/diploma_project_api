const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Bearer TOKEN
  console.log(token);

  if (!token) {
    return res.error(
      401,
      'Access denied. No token provided. Please login again',
      null,
    );
  }

  try {
    const verified = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your_secret_key',
    );
    req.user = verified;
    next();
  } catch {
    return res.error(403, 'Invalid or expired token. Please login again', null);
  }
};

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'your_secret_key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

const restrictTo =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res.error(403, 'You do not have permission to perform this action');

module.exports = { verifyToken, generateToken, restrictTo };
