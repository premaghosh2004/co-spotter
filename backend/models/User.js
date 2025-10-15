const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Authentication fields
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  
  // Profile Information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  age: {
    type: Number,
    required: [true, 'Age is required'],
    min: [18, 'Must be at least 18 years old'],
    max: [65, 'Age cannot exceed 65']
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: ['Male', 'Female', 'Other']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\d{10}$/, 'Please enter a valid 10-digit phone number']
  },
  avatar: {
    type: String,
    default: function() {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${this.name}`;
    }
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  
  // Location Information
  location: {
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    area: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  // Roommate Preferences
  preferences: {
    rentRange: {
      min: {
        type: Number,
        default: 300,
        min: [0, 'Minimum rent cannot be negative']
      },
      max: {
        type: Number,
        default: 2000,
        min: [0, 'Maximum rent cannot be negative']
      }
    },
    duration: {
      type: String,
      enum: ['1-3 months', '3-6 months', '6-12 months', '12+ months', 'Flexible'],
      default: 'Flexible'
    },
    genderPreference: {
      type: String,
      enum: ['Male', 'Female', 'Any'],
      default: 'Any'
    },
    foodPreference: {
      type: String,
      enum: ['Vegetarian', 'Non-Vegetarian', 'Any'],
      default: 'Any'
    },
    smokingPreference: {
      type: String,
      enum: ['Non-smoker', 'Smoker', 'Any'],
      default: 'Non-smoker'
    },
    petPreference: {
      type: String,
      enum: ['Pet-friendly', 'No pets', 'Any'],
      default: 'Any'
    },
    schedule: {
      type: String,
      enum: ['Early riser', 'Night owl', 'Flexible'],
      default: 'Flexible'
    }
  },
  
  // Room Information (if user is offering a room)
  roomDetails: {
    isOffering: {
      type: Boolean,
      default: false
    },
    rent: {
      type: Number,
      min: [0, 'Rent cannot be negative']
    },
    images: [{
      type: String
    }],
    description: {
      type: String,
      maxlength: [1000, 'Room description cannot exceed 1000 characters']
    },
    amenities: [{
      type: String
    }],
    availableFrom: {
      type: Date
    },
    roomType: {
      type: String,
      enum: ['Private', 'Shared', 'Studio']
    }
  },
  
  // User Traits
  traits: [{
    type: String
  }],
  
  // Social Information
  interests: [{
    type: String
  }],
  
  // System fields
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  savedProfiles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  profileViews: {
    type: Number,
    default: 0
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for location-based searches
userSchema.index({ 
  'location.city': 1, 
  'location.state': 1, 
  'preferences.rentRange.min': 1, 
  'preferences.rentRange.max': 1 
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to calculate compatibility score
userSchema.methods.calculateCompatibility = function(otherUser) {
  let score = 0;
  let factors = 0;
  
  // Location compatibility (30%)
  if (this.location.city === otherUser.location.city) {
    score += 30;
  } else if (this.location.state === otherUser.location.state) {
    score += 15;
  }
  factors += 30;
  
  // Rent range compatibility (25%)
  const rentOverlap = Math.max(0, 
    Math.min(this.preferences.rentRange.max, otherUser.roomDetails.rent || otherUser.preferences.rentRange.max) - 
    Math.max(this.preferences.rentRange.min, otherUser.roomDetails.rent || otherUser.preferences.rentRange.min)
  );
  if (rentOverlap > 0) {
    score += 25;
  }
  factors += 25;
  
  // Food preference compatibility (15%)
  if (this.preferences.foodPreference === otherUser.preferences.foodPreference || 
      this.preferences.foodPreference === 'Any' || 
      otherUser.preferences.foodPreference === 'Any') {
    score += 15;
  }
  factors += 15;
  
  // Smoking preference compatibility (15%)
  if (this.preferences.smokingPreference === otherUser.preferences.smokingPreference || 
      this.preferences.smokingPreference === 'Any' || 
      otherUser.preferences.smokingPreference === 'Any') {
    score += 15;
  }
  factors += 15;
  
  // Pet preference compatibility (10%)
  if (this.preferences.petPreference === otherUser.preferences.petPreference || 
      this.preferences.petPreference === 'Any' || 
      otherUser.preferences.petPreference === 'Any') {
    score += 10;
  }
  factors += 10;
  
  // Schedule compatibility (5%)
  if (this.preferences.schedule === otherUser.preferences.schedule || 
      this.preferences.schedule === 'Flexible' || 
      otherUser.preferences.schedule === 'Flexible') {
    score += 5;
  }
  factors += 5;
  
  return Math.round((score / factors) * 100);
};

// Method to get public profile (excluding sensitive data)
userSchema.methods.getPublicProfile = function() {
  const user = this.toObject();
  delete user.password;
  delete user.email;
  delete user.phone;
  return user;
};

module.exports = mongoose.model('User', userSchema);