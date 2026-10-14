const { cloudinary } = require('./multerMiddleware');

const deleteFileFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return;
    if (Array.isArray(publicId)) {
      if (publicId.length === 0) return;
      await cloudinary.api.delete_resources(publicId);
    } else {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
  }
};

module.exports = deleteFileFromCloudinary;
