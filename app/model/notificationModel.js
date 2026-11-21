// src/models/notification.model.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'CONNECTION_REQUEST',
        'CONNECTION_ACCEPTED',
        'JOB_APPLIED',
        'APPLICATION_STATUS',
        'MESSAGE',
        'SYSTEM',
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }, // jobId, userId ইত্যাদি
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// ৩০ দিন পরে অটো delete
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
);

export const Notification = mongoose.model('Notification', notificationSchema);
