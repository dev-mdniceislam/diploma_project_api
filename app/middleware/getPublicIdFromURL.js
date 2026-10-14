const getPublicIdFromUrl = (url) => {
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;

    const pathWithVersion = parts[1];
    const pathWithoutVersion = pathWithVersion.replace(/^v\d+\//, '');

    const publicId = pathWithoutVersion.substring(
      0,
      pathWithoutVersion.lastIndexOf('.'),
    );
    return publicId;
  } catch (err) {
    return null;
  }
};

module.exports = getPublicIdFromUrl;
