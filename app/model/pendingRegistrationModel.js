const mongoose = require('mongoose');

const pendingRegistrationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  otp: { type: String, required: true }, // bcrypt hash
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  // expire hole MongoDB nijei document delete kore dibe (TTL)
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = mongoose.model(
  'PendingRegistration',
  pendingRegistrationSchema,
);
