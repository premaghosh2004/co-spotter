const express = require('express');
const { query, body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/profiles
// @desc    Get profiles with filters for Find Roomie
// @access  Public (with optional auth)
router.get('/', 
  optionalAuth,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('city').optional().trim().escape(),
    query('state').optional().trim().escape(),
    query('minRent').optional().isFloat({ min: 0 }).withMessage('Minimum rent must be non-negative'),
    query('maxRent').optional().isFloat({ min: 0 }).withMessage('Maximum rent must be non-negative'),
    query('gender').optional().isIn(['Male', 'Female', 'Any']).withMessage('Invalid gender filter'),
    query('foodPreference').optional().isIn(['Vegetarian', 'Non-Vegetarian', 'Any']).withMessage('Invalid food preference'),
    query('duration').optional().isIn(['1-3 months', '3-6 months', '6-12 months', '12+ months', 'Flexible']).withMessage('Invalid duration'),
    query('sortBy').optional().isIn(['compatibility', 'rent', 'age', 'recent']).withMessage('Invalid sort option')
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

      const {
        page = 1,
        limit = 20,
        city,
        state,
        minRent,
        maxRent,
        gender,
        foodPreference,
        duration,
        sortBy = 'compatibility'
      } = req.query;

      // Build filter query
      let filter = {
        isActive: true,
        _id: { $ne: req.user?._id } // Exclude current user if authenticated
      };

      // Location filters
      if (city) {
        filter['location.city'] = { $regex: city, $options: 'i' };
      }
      if (state) {
        filter['location.state'] = { $regex: state, $options: 'i' };
      }

      // Rent range filters
      if (minRent || maxRent) {
        const rentFilter = {};
        if (minRent) {
          // Either user's max rent >= minRent OR room rent >= minRent
          rentFilter.$or = [
            { 'preferences.rentRange.max': { $gte: parseInt(minRent) } },
            { 'roomDetails.rent': { $gte: parseInt(minRent) } }
          ];
        }
        if (maxRent) {
          // Either user's min rent <= maxRent OR room rent <= maxRent
          if (rentFilter.$or) {
            rentFilter.$and = [
              { $or: rentFilter.$or },
              {
                $or: [
                  { 'preferences.rentRange.min': { $lte: parseInt(maxRent) } },
                  { 'roomDetails.rent': { $lte: parseInt(maxRent) } }
                ]
              }
            ];
            delete rentFilter.$or;
          } else {
            rentFilter.$or = [
              { 'preferences.rentRange.min': { $lte: parseInt(maxRent) } },
              { 'roomDetails.rent': { $lte: parseInt(maxRent) } }
            ];
          }
        }
        Object.assign(filter, rentFilter);
      }

      // Gender preference filter
      if (gender && gender !== 'Any') {
        filter.$or = [
          { 'preferences.genderPreference': 'Any' },
          { 'preferences.genderPreference': gender },
          { gender: gender }
        ];
      }

      // Food preference filter
      if (foodPreference && foodPreference !== 'Any') {
        filter.$or = [
          { 'preferences.foodPreference': 'Any' },
          { 'preferences.foodPreference': foodPreference }
        ];
      }

      // Duration filter
      if (duration && duration !== 'Flexible') {
        filter.$or = [
          { 'preferences.duration': 'Flexible' },
          { 'preferences.duration': duration }
        ];
      }

      // Calculate skip for pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Get profiles
      let profiles = await User.find(filter)
        .select('-password -email -phone -savedProfiles')
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Calculate compatibility scores if user is authenticated
      if (req.user) {
        profiles = profiles.map(profile => {
          const compatibility = req.user.calculateCompatibility(profile);
          return {
            ...profile,
            compatibility,
            isSaved: req.user.savedProfiles.includes(profile._id)
          };
        });
      } else {
        // Add random compatibility for non-authenticated users (for demo)
        profiles = profiles.map(profile => ({
          ...profile,
          compatibility: Math.floor(Math.random() * (95 - 70) + 70),
          isSaved: false
        }));
      }

      // Sort profiles
      switch (sortBy) {
        case 'compatibility':
          profiles.sort((a, b) => b.compatibility - a.compatibility);
          break;
        case 'rent':
          profiles.sort((a, b) => {
            const aRent = a.roomDetails?.rent || a.preferences?.rentRange?.max || 0;
            const bRent = b.roomDetails?.rent || b.preferences?.rentRange?.max || 0;
            return aRent - bRent;
          });
          break;
        case 'age':
          profiles.sort((a, b) => a.age - b.age);
          break;
        case 'recent':
          profiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          break;
        default:
          profiles.sort((a, b) => b.compatibility - a.compatibility);
      }

      // Get total count for pagination
      const total = await User.countDocuments(filter);
      const totalPages = Math.ceil(total / parseInt(limit));

      res.json({
        success: true,
        data: {
          profiles,
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
      console.error('Get profiles error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching profiles'
      });
    }
  }
);

// @route   GET /api/profiles/:id
// @desc    Get specific profile details
// @access  Public (with optional auth)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await User.findOne({
      _id: id,
      isActive: true
    }).select('-password -email -phone -savedProfiles');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Increment profile views
    await User.findByIdAndUpdate(id, { $inc: { profileViews: 1 } });

    let profileData = profile.toObject();

    // Add compatibility score if user is authenticated
    if (req.user && req.user._id.toString() !== id) {
      profileData.compatibility = req.user.calculateCompatibility(profile);
      profileData.isSaved = req.user.savedProfiles.includes(profile._id);
    } else {
      profileData.compatibility = null;
      profileData.isSaved = false;
    }

    res.json({
      success: true,
      data: {
        profile: profileData
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
});

// @route   POST /api/profiles/:id/save
// @desc    Save/unsave a profile
// @access  Private
router.post('/:id/save', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if profile exists
    const profileExists = await User.findOne({
      _id: id,
      isActive: true
    });

    if (!profileExists) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if user is trying to save their own profile
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot save your own profile'
      });
    }

    const user = await User.findById(req.user._id);
    const isSaved = user.savedProfiles.includes(id);

    if (isSaved) {
      // Unsave profile
      await User.findByIdAndUpdate(
        req.user._id,
        { $pull: { savedProfiles: id } },
        { new: true }
      );
      
      res.json({
        success: true,
        message: 'Profile removed from saved list',
        data: { isSaved: false }
      });
    } else {
      // Save profile
      await User.findByIdAndUpdate(
        req.user._id,
        { $addToSet: { savedProfiles: id } },
        { new: true }
      );
      
      res.json({
        success: true,
        message: 'Profile added to saved list',
        data: { isSaved: true }
      });
    }
  } catch (error) {
    console.error('Save profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while saving profile'
    });
  }
});

// @route   GET /api/profiles/saved/list
// @desc    Get user's saved profiles
// @access  Private
router.get('/saved/list', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findById(req.user._id)
      .populate({
        path: 'savedProfiles',
        select: '-password -email -phone -savedProfiles',
        match: { isActive: true },
        options: {
          skip,
          limit: parseInt(limit)
        }
      });

    // Calculate compatibility scores
    const savedProfiles = user.savedProfiles.map(profile => {
      const compatibility = req.user.calculateCompatibility(profile);
      return {
        ...profile.toObject(),
        compatibility,
        isSaved: true
      };
    });

    // Get total count
    const totalSaved = await User.findById(req.user._id)
      .populate({
        path: 'savedProfiles',
        match: { isActive: true },
        select: '_id'
      });

    const total = totalSaved.savedProfiles.length;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        profiles: savedProfiles,
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
    console.error('Get saved profiles error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching saved profiles'
    });
  }
});

// @route   GET /api/profiles/recommendations/:userId
// @desc    Get personalized profile recommendations
// @access  Private
router.get('/recommendations/:userId', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get profiles excluding current user and already saved profiles
    const profiles = await User.find({
      _id: { 
        $ne: req.user._id,
        $nin: req.user.savedProfiles
      },
      isActive: true,
      // Location preference - same city gets priority
      'location.city': req.user.location.city
    })
    .select('-password -email -phone -savedProfiles')
    .limit(parseInt(limit) * 2) // Get more to filter and sort
    .lean();

    // Calculate compatibility and sort
    const recommendations = profiles
      .map(profile => {
        const compatibility = req.user.calculateCompatibility(profile);
        return {
          ...profile,
          compatibility,
          isSaved: false
        };
      })
      .filter(profile => profile.compatibility >= 70) // Only high compatibility
      .sort((a, b) => b.compatibility - a.compatibility)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        recommendations
      }
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recommendations'
    });
  }
});

// @route   GET /api/profiles/search/suggestions
// @desc    Get search suggestions for locations
// @access  Public
router.get('/search/suggestions', async (req, res) => {
  try {
    const { q, type = 'city' } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: { suggestions: [] }
      });
    }

    let suggestions = [];

    if (type === 'city') {
      suggestions = await User.distinct('location.city', {
        'location.city': { $regex: q, $options: 'i' },
        isActive: true
      });
    } else if (type === 'state') {
      suggestions = await User.distinct('location.state', {
        'location.state': { $regex: q, $options: 'i' },
        isActive: true
      });
    }

    res.json({
      success: true,
      data: {
        suggestions: suggestions.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Get search suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching suggestions'
    });
  }
});

module.exports = router;