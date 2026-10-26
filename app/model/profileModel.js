const mongoose = require('mongoose');
const { Schema } = mongoose;

const skillSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    percent: { type: Number, min: 0, max: 100, default: 0 },
    tone: {
      type: String,
      enum: ['primary', 'success', 'info', 'warning', 'danger'],
      default: 'primary',
    },
  },
  { _id: false },
);

const semesterResultSchema = new Schema(
  {
    semester: { type: Number, required: true, min: 1, max: 8 },
    year: { type: Number, required: true },
    gpa: { type: Number, required: true, min: 0, max: 4 },
    passed: { type: Boolean, default: true },
  },
  { _id: false },
);

const sscSchema = new Schema(
  {
    school: String,
    group: String,
    board: String,
    year: Number,
    gpa: { type: Number, min: 0, max: 5 },
  },
  { _id: false },
);

const projectSchema = new Schema({
  category: { type: String, trim: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  technologies: [{ type: String, trim: true }],
  icon: { type: String, default: 'code' },
  liveUrl: String,
  repoUrl: String,
});

const applicationSchema = new Schema({
  company: { type: String, required: true, trim: true },
  position: { type: String, required: true, trim: true },
  type: { type: String, enum: ['attachment', 'job'], required: true },
  appliedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'shortlisted', 'interview', 'selected', 'rejected'],
    default: 'pending',
  },
  message: { type: String, trim: true },
});

const certificateSchema = new Schema({
  title: { type: String, required: true, trim: true },
  issuer: { type: String, trim: true },
});

const socialLinkSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['linkedin', 'github', 'facebook', 'twitter', 'portfolio', 'other'],
      required: true,
    },
    url: { type: String, required: true },
  },
  { _id: false },
);

const studentProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: '' },
    coverImage: { type: String, default: '' },

    department: { type: String, required: true, trim: true },
    institute: { type: String, required: true, trim: true },
    boardRoll: { type: String, required: true, unique: true, index: true },
    registration: { type: String, required: true, unique: true },
    session: { type: String, required: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    cgpa: { type: Number, min: 0, max: 4 },
    cgpaScale: { type: Number, default: 4.0 },

    isVerified: { type: Boolean, default: false },
    nocStatus: {
      type: String,
      enum: ['none', 'pending', 'issued', 'rejected'],
      default: 'none',
    },
    nocNumber: { type: String, default: null },

    bio: { type: String, trim: true, maxlength: 1500 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },
    cvUrl: { type: String, default: null },

    skills: [skillSchema],
    semesterResults: [semesterResultSchema],
    ssc: sscSchema,
    projects: [projectSchema],
    applications: [applicationSchema],
    certificates: [certificateSchema],
    socialLinks: [socialLinkSchema],
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

// Auto-calculate CGPA from semester results
studentProfileSchema.pre('save', function () {
  if (this.isModified('semesterResults') && this.semesterResults.length) {
    const total = this.semesterResults.reduce((sum, r) => sum + r.gpa, 0);
    this.cgpa = Number((total / this.semesterResults.length).toFixed(2));
  }
});

studentProfileSchema.index({ department: 1, semester: 1 });
studentProfileSchema.index({ name: 'text', institute: 'text' });

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
