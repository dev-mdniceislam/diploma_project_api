const User = require('../model/userModel');
const { generateToken } = require('../middleware/authMiddleware');
// Helper to generate JWT Token

exports.register = async (req, res) => {
  try {
    const { role, name, email, password } = req.body;

    // Validation Check
    if (!role || !name || !email || !password) {
      return res.error(400, 'Please provide all required fields');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.error(409, 'Email already registered. Please login.');
    }

    // Create user
    const user = await User.create({
      role,
      name,
      email,
      password,
    });

    // Generate JWT token
    const token = generateToken(user._id, user.role);

    // Response Data
    const userData = {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      token,
    };

    return res.success(201, 'User registered successfully', userData);
  } catch (error) {
    return res.error(500, error.message || 'Internal Server Error');
  }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.error(400, 'Please provide email and password');
    }

    // Find user & select password explicitly
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.error(401, 'Invalid email or password');
    }

    const token = generateToken(user._id, user.role);

    const userData = {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      token,
    };

    return res.success(200, 'Login successful', userData);
  } catch (error) {
    return res.error(500, error.message || 'Internal Server Error');
  }
};

// @desc    Get Current Logged in User Profile
// @route   GET /api/v1/auth/me
// @access  Private (Uses verifyToken middleware)
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.error(404, 'User not found');
    }

    return res.success(200, 'Profile fetched successfully', {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    return res.error(500, error.message || 'Internal Server Error');
  }
};
