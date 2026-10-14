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
    folder: 'gia_uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  },
});

const upload = multer({ storage });

module.exports = { upload, cloudinary };
