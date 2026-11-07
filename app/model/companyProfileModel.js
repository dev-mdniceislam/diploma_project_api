const mongoose = require('mongoose');

const engineeringDomainSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true }, // যেমন: PLC & Robotic Automation
    description: { type: String, trim: true, maxlength: 300 }, // যেমন: স্বয়ংক্রিয় অ্যাসেম্বলি লাইন
  },
  { _id: false },
);

const campusPartnerSchema = new mongoose.Schema(
  {
    instituteName: { type: String, required: true, trim: true },
    annualInternQuota: { type: Number, min: 0, default: 0 },
    isMouVerified: { type: Boolean, default: false },
  },
  { _id: false },
);

const companyProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [150, 'Company name can be at most 150 characters'],
    },

    email: {
      type: String,
      trim: true,
      required: [true, 'Email is required'],
      lowercase: true,
    },

    industryCategory: {
      type: String,
      trim: true,
      default: '',
    },

    about: {
      type: String,
      trim: true,
      maxlength: [3000, 'About can be at most 3000 characters'],
      default: '',
    },

    hrEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },

    helplineNumber: {
      type: String,
      trim: true,
      default: '',
    },

    website: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    employeeCount: { type: String, trim: true, default: '0' },

    profileUrl: { type: String, trim: true, default: '' },
    coverImageUrl: { type: String, trim: true, default: '' },

    engineeringDomains: [engineeringDomainSchema],
    benefits: [{ type: String, trim: true }],
    campusPartners: [campusPartnerSchema],

    isVerified: { type: Boolean, default: false },
    isBtebApproved: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

module.exports = mongoose.model('CompanyProfile', companyProfileSchema);
