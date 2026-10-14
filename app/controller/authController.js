const User = require('../model/userModel');
const { generateToken } = require('../middleware/authMiddleware');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

// Helper to generate JWT Token

exports.register = async (req, res) => {
  try {
    const { role, name, email, password } = req.body;

    // Validation Check
    if (!role || !name || !email || !password) {
      return res.error(400, 'Please provide all required fields');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.error(409, 'Email already registered. Please login.');
    }

    // Create user
    const user = await User.create({
      role,
      name,
      email,
      password,
    });

    // Generate JWT token
    const token = generateToken(user._id, user.role);

    // Response Data
    const userData = {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      token,
    };

    return res.success(201, 'User registered successfully', userData);
  } catch (error) {
    return res.error(500, error.message || 'Internal Server Error');
  }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.error(400, 'Please provide email and password');
    }

    // Find user & select password explicitly
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.error(401, 'Invalid email or password');
    }

    const token = generateToken(user._id, user.role);

    const userData = {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      token,
    };

    return res.success(200, 'Login successful', userData);
  } catch (error) {
    return res.error(500, error.message || 'Internal Server Error');
  }
};

// @desc    Get Current Logged in User Profile
// @route   GET /api/v1/auth/me
// @access  Private (Uses verifyToken middleware)
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.error(404, 'User not found');
    }

    return res.success(200, 'Profile fetched successfully', {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    return res.error(500, error.message || 'Internal Server Error');
  }
};

// @desc    Send OTP to email for password reset
// @route   POST /api/v1/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.error(400, 'Please provide your email address');
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Email registered kina seta hide rakhi (user enumeration rodh)
    if (!user) {
      return res.success(200, 'If this email exists, an OTP has been sent');
    }

    const otp = crypto.randomInt(100000, 1000000).toString();

    user.resetPasswordOtp = await bcrypt.hash(otp, 10);
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 min
    user.resetPasswordAttempts = 0;
    await user.save({ validateBeforeSave: false });

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset OTP (Career Orbit)',
        message: `Hi ${user.name},\n\nYour password reset OTP is: ${otp}\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, ignore this email.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px">
            <h2>Career Orbit</h2>
            <p>Hi ${user.name},</p>
            <p>Your password reset OTP is:</p>
            <p style="font-size:28px;letter-spacing:6px;font-weight:bold">${otp}</p>
            <p>This OTP is valid for <b>10 minutes</b>.</p>
            <p style="color:#888">If you did not request this, ignore this email.</p>
          </div>`,
      });
    } catch (mailError) {
      console.error('Email error:', mailError.message);
      user.resetPasswordOtp = undefined;
      user.resetPasswordExpires = undefined;
      user.resetPasswordAttempts = 0;
      await user.save({ validateBeforeSave: false });

      return res.error(500, 'Email could not be sent. Please try again later.');
    }

    return res.success(200, 'If this email exists, an OTP has been sent');
  } catch (error) {
    return res.error(500, error.message || 'Internal Server Error');
  }
};

// @desc    Verify OTP and get reset token
// @route   POST /api/v1/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.error(400, 'Please provide email and OTP');
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select('+resetPasswordOtp +resetPasswordExpires +resetPasswordAttempts');

    if (
      !user ||
      !user.resetPasswordOtp ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < Date.now() ||
      user.resetPasswordAttempts >= 5
    ) {
      return res.error(400, 'Invalid OTP or OTP has expired');
    }

    const isMatch = await bcrypt.compare(String(otp), user.resetPasswordOtp);

    if (!isMatch) {
      user.resetPasswordAttempts += 1;
      await user.save({ validateBeforeSave: false });
      return res.error(400, 'Invalid OTP or OTP has expired');
    }

    // OTP thik. Ekhon reset token banao (OTP ek bar-i use hobe)
    const resetToken = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordTokenExpires = Date.now() + 10 * 60 * 1000; // 10 min

    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    user.resetPasswordAttempts = 0;
    await user.save({ validateBeforeSave: false });

    return res.success(200, 'OTP verified successfully', { resetToken });
  } catch (error) {
    return res.error(500, error.message || 'Internal Server Error');
  }
};

// @desc    Reset password using reset token
// @route   POST /api/v1/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.error(400, 'Please provide reset token and new password');
    }

    if (newPassword.length < 8) {
      return res.error(400, 'Password must be at least 8 characters long');
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(String(resetToken))
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.error(400, 'Reset session expired. Please start again.');
    }

    user.password = newPassword; // pre-save hook hash korbe
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpires = undefined;
    await user.save();

    return res.success(
      200,
      'Password reset successful. Please login with your new password.',
    );
  } catch (error) {
    return res.error(500, error.message || 'Internal Server Error');
  }
};
