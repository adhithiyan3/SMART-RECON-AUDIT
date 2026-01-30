const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

exports.signup = async (req, res) => {
  try {
    const { email, password, role, name } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({
      email,
      password,
      name,
      role: role || 'Viewer'
    });

    logger.info(`User registered: ${email}`);

    res.status(201).json({
      message: 'Signup successful',
      email: user.email,
      role: user.role
    });
  } catch (error) {
    logger.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
};

exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    logger.info(`User login: ${email}`);

    res.json({
      token,
      role: user.role,
      email: user.email
    });
  } catch (error) {
    logger.error('Signin error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    logger.error('Get user info error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
};
