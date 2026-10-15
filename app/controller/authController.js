const User = require('../model/userModel');
const { generateToken } = require('../middleware/authMiddleware');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
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
  <div style="background-color:#f3f4f8;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td align="center" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);background-color:#4f46e5;padding:28px 24px;">
          <h1 style="margin:0;font-size:24px;color:#ffffff;letter-spacing:0.5px;">Career Orbit</h1>
          <p style="margin:6px 0 0;font-size:13px;color:#e0e7ff;">Password Reset Request</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:32px 28px 8px;color:#374151;">
          <p style="margin:0 0 12px;font-size:16px;">Hi <b>${user.name}</b>,</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">
            Use the code below to reset your password.
          </p>
        </td>
      </tr>

      <!-- OTP Box -->
      <tr>
        <td align="center" style="padding:20px 28px;">
          <div style="display:inline-block;background-color:#eef2ff;border:2px dashed #6366f1;border-radius:12px;padding:16px 32px;">
            <span style="font-size:34px;font-weight:bold;letter-spacing:10px;color:#4f46e5;font-family:'Courier New',monospace;">
              ${otp}
            </span>
          </div>
        </td>
      </tr>

      <!-- Validity -->
      <tr>
        <td align="center" style="padding:0 28px 24px;">
          <p style="margin:0;font-size:14px;color:#4b5563;">
            This code is valid for <b style="color:#4f46e5;">10 minutes</b>.
          </p>
        </td>
      </tr>

      <!-- Security note -->
      <tr>
        <td style="padding:0 28px 28px;">
          <div style="background-color:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;padding:12px 14px;">
            <p style="margin:0;font-size:13px;line-height:1.5;color:#991b1b;">
              If you didn't request this, you can safely ignore this email. Never share this code with anyone.
            </p>
          </div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td align="center" style="background-color:#f9fafb;padding:16px 24px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            &copy; ${new Date().getFullYear()} Career Orbit. All rights reserved.
          </p>
        </td>
      </tr>

    </table>
  </div>`,
      });
    } catch (mailError) {
      console.error('Email error:', mailError);
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

    user.password = newPassword;
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
