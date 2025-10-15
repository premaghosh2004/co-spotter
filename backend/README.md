# Co-Spotter Backend API

Backend API for the Co-Spotter roommate finding application built with Node.js, Express, and MongoDB.

## Features

- 🔐 **Authentication & Authorization** - JWT-based auth with secure password hashing
- 👥 **Profile Management** - Comprehensive user profiles with preferences
- 🔍 **Smart Matching** - Compatibility algorithm for roommate matching
- 💬 **Real-time Chat** - Messaging system between users
- 🏠 **Room Listings** - Room details and availability management
- 📱 **RESTful API** - Clean, documented API endpoints
- 🛡️ **Security** - Rate limiting, validation, and security headers

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JSON Web Tokens (JWT)
- **Validation:** Express Validator
- **Security:** Helmet, Rate Limiting, CORS
- **File Upload:** Multer + Cloudinary

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB Atlas account or local MongoDB instance
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd co-spotter/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Update the environment variables:
   
   ```bash
   cp .env.example .env
   ```
   
   **Required Environment Variables:**
   - `MONGODB_URI` - Your MongoDB connection string
   - `JWT_SECRET` - Secret key for JWT tokens
   - `FRONTEND_URL` - Your frontend URL for CORS
   - `CLOUDINARY_*` - Cloudinary credentials for image uploads

4. **Start the development server**
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:5000`

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - User login
- `GET /me` - Get current user profile
- `PUT /profile` - Update user profile
- `POST /change-password` - Change password
- `DELETE /account` - Deactivate account

### Profiles (`/api/profiles`)
- `GET /` - Get profiles with filters
- `GET /:id` - Get specific profile
- `POST /:id/save` - Save/unsave profile
- `GET /saved/list` - Get saved profiles
- `GET /recommendations/:userId` - Get recommendations
- `GET /search/suggestions` - Get location suggestions

### Users (`/api/users`)
- `GET /search` - Search users
- `GET /stats` - Get user statistics
- `PUT /preferences` - Update preferences
- `PUT /room-details` - Update room details

### Chat (`/api/chat`)
- `GET /conversations` - Get conversations
- `GET /messages/:userId` - Get messages with user
- `POST /send` - Send message
- `PUT /messages/:messageId/read` - Mark as read
- `GET /unread-count` - Get unread count

### Health Check
- `GET /api/health` - API health status

## Database Schema

### User Model
The User model includes:
- Authentication fields (email, password)
- Profile information (name, age, gender, location)
- Preferences (rent range, duration, food preference, etc.)
- Room details (if offering a room)
- Social information (traits, interests)
- System fields (active status, verification, etc.)

### Message Model
For chat functionality:
- Sender and recipient references
- Message content and type
- Read status and timestamps

### Conversation Model
For managing chat conversations:
- Participants array
- Last message reference
- Last activity timestamp

## Features

### Smart Compatibility Algorithm
The backend includes a sophisticated compatibility scoring system that considers:
- Location proximity (30% weight)
- Rent range compatibility (25% weight)
- Food preferences (15% weight)
- Smoking preferences (15% weight)
- Pet preferences (10% weight)
- Schedule compatibility (5% weight)

### Security Features
- Password hashing with bcrypt
- JWT token authentication
- Rate limiting to prevent abuse
- Input validation and sanitization
- CORS configuration
- Security headers with Helmet

### Search & Filtering
- Advanced profile filtering by location, rent, preferences
- Smart search suggestions
- Pagination for large datasets
- Sorting by compatibility, rent, age, etc.

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (to be implemented)

### Code Structure
```
backend/
├── config/
│   └── database.js          # MongoDB connection
├── middleware/
│   └── auth.js             # JWT authentication
├── models/
│   └── User.js             # User schema
├── routes/
│   ├── auth.js             # Authentication routes
│   ├── profiles.js         # Profile management
│   ├── users.js            # User operations
│   └── chat.js             # Messaging system
├── .env.example            # Environment template
├── .gitignore             # Git ignore rules
├── package.json           # Dependencies
├── server.js              # Main server file
└── README.md              # This file
```

## Deployment

### Production Environment
1. Set `NODE_ENV=production` in environment variables
2. Use a production MongoDB cluster
3. Configure secure JWT secrets
4. Set up proper CORS origins
5. Enable SSL/TLS certificates

### Recommended Platforms
- **Heroku** - Easy deployment with MongoDB Atlas
- **Railway** - Modern deployment platform
- **Render** - Free tier available
- **DigitalOcean App Platform** - Scalable option

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

If you encounter any issues or have questions, please create an issue in the repository.
