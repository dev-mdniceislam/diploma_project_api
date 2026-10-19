// utils/otp.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 min
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 min
const MAX_ATTEMPTS = 5;

// Notun OTP banay: plain otp (email e jabe) + hash + expiry (DB te jabe)
const createOtp = async () => {
  const otp = crypto.randomInt(100000, 1000000).toString();
  return {
    otp,
    hash: await bcrypt.hash(otp, 10),
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
  };
};

// OTP thik, expire hoy ni, attempt limit er moddhe -> true
const verifyOtp = async ({ hash, expiresAt, attempts = 0 }, input) => {
  if (!hash || !expiresAt || expiresAt < Date.now()) return false;
  if (attempts >= MAX_ATTEMPTS) return false;
  return bcrypt.compare(String(input), hash);
};

const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

module.exports = {
  OTP_EXPIRY_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS,
  createOtp,
  verifyOtp,
  hashToken,
};
