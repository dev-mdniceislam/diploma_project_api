// utils/catchAsync.js
// Controller er try/catch bar bar likhte hobe na. Shob error ekhane handle hoy.
module.exports = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);

    // Unique index error (email duplicate / race condition)
    if (err.code === 11000) {
      return res.error(409, 'Email already registered. Please login.');
    }

    // Mongoose validation error (jemon invalid role, choto password)
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(', ');
      return res.error(400, msg);
    }

    return res.error(500, 'Internal Server Error, Please try again.');
  });
