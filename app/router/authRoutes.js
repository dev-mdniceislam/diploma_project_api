const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const {
  register,
  login,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPassword,
  sendRegisterPin,
} = require('../controller/authController');
const { verifyToken } = require('../middleware/authMiddleware');

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

router.post('/register-otp', otpLimiter, sendRegisterPin);
router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, getMe);

// forgot password flow
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/verify-otp', otpLimiter, verifyOtp);
router.post('/reset-password', otpLimiter, resetPassword);

module.exports = router;
