const crypto = require('crypto');
const User = require('../model/userModel');
const PendingRegistration = require('../model/pendingRegistrationModel');
const { generateToken } = require('../middleware/authMiddleware');
const sendEmail = require('../utils/sendEmail');
const catchAsync = require('../utils/catchAsync');
const {
  registerOtpEmail,
  resetOtpEmail,
  welcomeEmail,
} = require('../utils/emailPallets');
const {
  RESEND_COOLDOWN_MS,
  createOtp,
  verifyOtp,
  hashToken,
} = require('../utils/otp');

// ---------------- helpers ----------------
const normalizeEmail = (email) => email?.toLowerCase().trim();

// Email pathay. Success hole true, fail hole false (throw kore na)
const trySendEmail = async (options) => {
  try {
    await sendEmail(options);
    return true;
  } catch (err) {
    console.error('Email error:', err.message);
    return false;
  }
};

// Response a user er data (token thakle token soho)
const userPayload = (user, token) => ({
  id: user._id,
  role: user.role,
  name: user.name,
  email: user.email,
  ...(token && { token }),
});

const MAIL_FAIL_MSG = 'Email could not be sent. Please try again later.';
const OTP_SENT_MSG = 'If this email exists, an OTP has been sent';

// =====================================================
// REGISTER (Step 1): email e OTP pathao
// =====================================================
exports.sendRegisterPin = catchAsync(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return res.error(400, 'Please provide an email.');

  if (await User.exists({ email })) {
    return res.error(409, 'Email already registered. Please login.');
  }

  // Resend cooldown (spam rokhte)
  const pending = await PendingRegistration.findOne({ email });
  if (pending && Date.now() - pending.lastSentAt < RESEND_COOLDOWN_MS) {
    return res.error(429, 'Please wait a minute before requesting a new code.');
  }

  const { otp, hash, expiresAt } = await createOtp();

  await PendingRegistration.findOneAndUpdate(
    { email },
    { otp: hash, attempts: 0, lastSentAt: new Date(), expiresAt },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (!(await trySendEmail({ email, ...registerOtpEmail(otp) }))) {
    await PendingRegistration.deleteOne({ email });
    return res.error(500, MAIL_FAIL_MSG);
  }

  return res.success(200, 'Verification code sent to your email');
});

// =====================================================
// REGISTER (Step 2): OTP + baki data diye account khol
// =====================================================
exports.register = catchAsync(async (req, res) => {
  const { role, name, password, otp } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!role || !name || !email || !password || !otp) {
    return res.error(400, 'Please provide all required fields');
  }

  if (await User.exists({ email })) {
    return res.error(409, 'Email already registered. Please login.');
  }

  const pending = await PendingRegistration.findOne({ email });
  const valid =
    pending &&
    (await verifyOtp(
      {
        hash: pending.otp,
        expiresAt: pending.expiresAt,
        attempts: pending.attempts,
      },
      otp,
    ));

  if (!valid) {
    if (pending) {
      pending.attempts += 1;
      await pending.save();
    }
    return res.error(400, 'Invalid code or code has expired');
  }

  const user = await User.create({ role, name, email, password });
  await pending.deleteOne(); // OTP ek bar-i use hobe

  // Welcome email fail hole registration fail hobe na
  await trySendEmail({ email: user.email, ...welcomeEmail(user) });

  const token = generateToken(user._id, user.role);
  return res.success(
    201,
    'User registered successfully',
    userPayload(user, token),
  );
});

// =====================================================
// LOGIN / ME
// =====================================================
exports.login = catchAsync(async (req, res) => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!email || !password) {
    return res.error(400, 'Please provide email and password');
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.error(401, 'Invalid email or password');
  }

  const token = generateToken(user._id, user.role);
  return res.success(200, 'Login successful', userPayload(user, token));
});

exports.getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.error(404, 'User not found');

  return res.success(200, 'Profile fetched successfully', userPayload(user));
});

// =====================================================
// FORGOT PASSWORD (3 step)
// =====================================================
exports.forgotPassword = catchAsync(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return res.error(400, 'Please provide your email address');

  const user = await User.findOne({ email });
  if (!user) return res.error(404, 'User not found. Please Registration now.');

  const { otp, hash, expiresAt } = await createOtp();

  Object.assign(user, {
    resetPasswordOtp: hash,
    resetPasswordExpires: expiresAt,
    resetPasswordAttempts: 0,
  });
  await user.save({ validateBeforeSave: false });

  if (
    !(await trySendEmail({ email: user.email, ...resetOtpEmail(user, otp) }))
  ) {
    Object.assign(user, {
      resetPasswordOtp: undefined,
      resetPasswordExpires: undefined,
    });
    await user.save({ validateBeforeSave: false });
    return res.error(500, MAIL_FAIL_MSG);
  }

  return res.success(200, OTP_SENT_MSG);
});

exports.verifyOtp = catchAsync(async (req, res) => {
  const { otp } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!email || !otp) return res.error(400, 'Please provide email and OTP');

  const user = await User.findOne({ email }).select(
    '+resetPasswordOtp +resetPasswordExpires +resetPasswordAttempts',
  );

  const valid =
    user &&
    (await verifyOtp(
      {
        hash: user.resetPasswordOtp,
        expiresAt: user.resetPasswordExpires,
        attempts: user.resetPasswordAttempts,
      },
      otp,
    ));

  if (!valid) {
    if (user) {
      user.resetPasswordAttempts += 1;
      await user.save({ validateBeforeSave: false });
    }
    return res.error(400, 'Invalid OTP or OTP has expired');
  }

  // OTP thik. Reset token banao (OTP ek bar-i use hobe)
  const resetToken = crypto.randomBytes(32).toString('hex');

  Object.assign(user, {
    resetPasswordToken: hashToken(resetToken),
    resetPasswordTokenExpires: Date.now() + 10 * 60 * 1000, // 10 min
    resetPasswordOtp: undefined,
    resetPasswordExpires: undefined,
    resetPasswordAttempts: 0,
  });
  await user.save({ validateBeforeSave: false });

  return res.success(200, 'OTP verified successfully', { resetToken });
});

exports.resetPassword = catchAsync(async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return res.error(400, 'Please provide reset token and new password');
  }
  if (newPassword.length < 8) {
    return res.error(400, 'Password must be at least 8 characters long');
  }

  const user = await User.findOne({
    resetPasswordToken: hashToken(resetToken),
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
});
