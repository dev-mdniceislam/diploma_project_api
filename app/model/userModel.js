const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: ['student', 'company'],
      default: 'student',
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false,
    },

    resetPasswordOtp: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    resetPasswordAttempts: { type: Number, default: 0, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordTokenExpires: { type: Date, select: false },
  },
  {
    timestamps: true,
  },
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
