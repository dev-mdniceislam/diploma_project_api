const responseHandler = (req, res, next) => {
  res.success = (statusCode = 200, message = 'Success', data) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  };

  res.error = (
    statusCode = 500,
    message = 'Something went wrong',
    data = null,
  ) => {
    return res.status(statusCode).json({
      success: false,
      message,
      data: data,
    });
  };

  next();
};

module.exports = responseHandler;
