const express = require('express');
const { query, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/users/search
// @desc    Search users by name, location, or other criteria
// @access  Private
router.get('/search', 
  authenticateToken,
  [
    query('q').optional().trim().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: errors.array()
        });
      }

      const { q, page = 1, limit = 10 } = req.query;
      
      if (!q) {
        return res.json({
          success: true,
          data: {
            users: [],
            pagination: {
              currentPage: parseInt(page),
              totalPages: 0,
              totalResults: 0
            }
          }
        });
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build search query
      const searchQuery = {
        $and: [
          { isActive: true },
          { _id: { $ne: req.user._id } },
          {
            $or: [
              { name: { $regex: q, $options: 'i' } },
              { 'location.city': { $regex: q, $options: 'i' } },
              { 'location.state': { $regex: q, $options: 'i' } },
              { bio: { $regex: q, $options: 'i' } }
            ]
          }
        ]
      };

      const users = await User.find(searchQuery)
        .select('name age gender location avatar bio preferences.foodPreference createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await User.countDocuments(searchQuery);
      const totalPages = Math.ceil(total / parseInt(limit));

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalResults: total,
            hasNext: parseInt(page) < totalPages,
            hasPrev: parseInt(page) > 1
          }
        }
      });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while searching users'
      });
    }
  }
);

// @route   GET /api/users/stats
// @desc    Get user statistics and analytics
// @access  Private
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user with populated saved profiles
    const user = await User.findById(userId)
      .populate('savedProfiles', 'name location')
      .select('profileViews savedProfiles createdAt');

    // Get statistics
    const stats = {
      profileViews: user.profileViews || 0,
      savedProfiles: user.savedProfiles.length,
      memberSince: user.createdAt,
      savedProfilesDetails: user.savedProfiles.map(profile => ({
        id: profile._id,
        name: profile.name,
        location: `${profile.location.city}, ${profile.location.state}`
      }))
    };

    // Get monthly profile views (mock data - in real app, you'd track this)
    const monthlyViews = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      data: [12, 19, 15, 25, 22, 30] // Mock data
    };

    res.json({
      success: true,
      data: {
        stats,
        monthlyViews
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user statistics'
    });
  }
});

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { preferences } = req.body;

    if (!preferences) {
      return res.status(400).json({
        success: false,
        message: 'Preferences data is required'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { preferences } },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating preferences'
    });
  }
});

// @route   PUT /api/users/room-details
// @desc    Update room details
// @access  Private
router.put('/room-details', authenticateToken, async (req, res) => {
  try {
    const { roomDetails } = req.body;

    if (!roomDetails) {
      return res.status(400).json({
        success: false,
        message: 'Room details data is required'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { roomDetails } },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Room details updated successfully',
      data: {
        roomDetails: user.roomDetails
      }
    });
  } catch (error) {
    console.error('Update room details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating room details'
    });
  }
});

module.exports = router;