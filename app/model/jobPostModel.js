const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [150, 'Job title can be at most 150 characters'],
    },

    jobType: {
      type: String,
      enum: {
        values: [
          'industrial-attachment',
          'internship',
          'full-time',
          'part-time',
          'contract',
        ],
        message: '{VALUE} is not a valid job type',
      },
      required: [true, 'Job type is required'],
    },

    description: {
      type: String,
      required: [true, 'Job description is required'],
      trim: true,
      maxlength: [5000, 'Description can be at most 5000 characters'],
    },

    responsibilities: [{ type: String, trim: true }],
    requirements: [{ type: String, trim: true }],

    // যেমন: ['CST', 'EEE', 'Robotics & Mechatronics']
    departments: [{ type: String, trim: true }],

    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },

    // মাসিক স্টাইপেন্ড (BDT)
    stipend: {
      type: Number,
      min: [0, 'Stipend cannot be negative'],
      default: 0,
    },

    semester: {
      type: String, // যেমন: '8th'
      trim: true,
    },

    educationRequirement: {
      type: String,
      trim: true,
    },

    vacancies: {
      type: Number,
      required: [true, 'Number of vacancies is required'],
      min: [1, 'At least 1 vacancy is required'],
    },

    accommodation: {
      type: String,
      enum: ['free', 'paid', 'none'],
      default: 'none',
    },

    deadline: {
      type: Date,
      required: [true, 'Application deadline is required'],
      validate: {
        validator: (value) => value > new Date(),
        message: 'Deadline must be a future date',
      },
    },

    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    website: { type: String, trim: true },

    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
  },
  { timestamps: true },
);

jobSchema.index({ postedBy: 1, createdAt: -1 });
jobSchema.index({ status: 1, deadline: 1 });

module.exports = mongoose.model('Job', jobSchema);
