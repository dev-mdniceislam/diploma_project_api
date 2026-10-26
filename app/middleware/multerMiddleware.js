const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage Setup for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'career_orbit_uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    resource_type: 'auto',
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { upload, cloudinary };
