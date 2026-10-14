const multer = require('multer');

// Express Error Handling Middleware
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(err);
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.error(400, 'File size is too large! Maximum limit is 5MB.');
    }
    return res.error(400, err.message);
  }

  if (err.name === 'ValidationError' && err.errors) {
    const customMessage = Object.values(err.errors)[0].message;
    return res.error(400, customMessage);
  }

  if (err.name === 'CastError') {
    return res.error(400, `Invalid ${err.path}: ${err.value}`);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.error(409, `${field} already exists.`);
  }

  if (err.name === 'JsonWebTokenError') {
    return res.error(401, 'Invalid token. Please log in again.');
  }

  if (err.name === 'TokenExpiredError') {
    return res.error(401, 'Token expired. Please log in again.');
  }

  return res.error(
    err.statusCode || 500,
    err.message || 'Internal Server Error',
  );
};

module.exports = errorHandler;
