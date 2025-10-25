# Poltrona - React Native Barbershop Management App

A complete mobile application for barbershop management built with React Native, Expo, and Supabase.

## 🚀 Features

- **Authentication**: Secure user registration and login
- **Dashboard**: Real-time KPIs and upcoming appointments overview
- **Calendar**: Weekly view with staff filtering and appointment management
- **Client Management**: Search, view, and manage client information
- **Appointment Management**: Create, update, and track appointments
- **Real-time Updates**: Live data synchronization with Supabase
- **Responsive Design**: Optimized for mobile devices with glassmorphism UI

## 🛠 Tech Stack

- **React Native** with Expo
- **TypeScript** for type safety
- **Supabase** for backend and real-time database
- **React Navigation** for navigation
- **Expo Linear Gradient** for beautiful gradients
- **Expo Blur** for glassmorphism effects

## 📱 Screenshots

The app features a modern glassmorphism design with:
- Dark gradient backgrounds
- Translucent cards with blur effects
- Intuitive navigation
- Professional color scheme (blue/purple palette)

## 🔧 Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- Expo CLI (`npm install -g @expo/cli`)
- Supabase account and project

### 1. Clone and Install

```bash
git clone <repository-url>
cd poltrona
npm install
```

### 2. Supabase Configuration

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

4. Update the `.env` file with your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Database Setup

The app expects the following database schema (already defined in your existing Supabase project):

- `shops` - Shop information
- `profiles` - User profiles linked to auth.users
- `staff` - Staff members
- `services` - Available services
- `clients` - Client information
- `appointments` - Appointment bookings

### 4. Row Level Security (RLS)

Ensure RLS is enabled on all tables with appropriate policies:

```sql
-- Example policy for appointments
CREATE POLICY "Users can manage shop appointments" ON appointments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.shop_id = appointments.shop_id
  )
);
```

### 5. Run the App

```bash
# Start the development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

## 📱 App Structure

```
src/
├── components/          # Reusable UI components
│   └── ui/             # Basic UI components (Card, Button, etc.)
├── contexts/           # React contexts (Auth)
├── navigation/         # Navigation configuration
├── screens/           # App screens
├── services/          # API services and database operations
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

## 🔐 Authentication Flow

1. **Sign Up**: Users can create new accounts
2. **Sign In**: Existing users can log in
3. **Profile Creation**: Automatic profile creation linked to shop
4. **Session Management**: Persistent sessions with automatic refresh

## 📊 Key Features

### Dashboard
- Today's appointment count
- Completed appointments
- No-show tracking
- Revenue estimation
- Upcoming appointments list

### Calendar
- Weekly view
- Staff filtering
- Appointment status indicators
- Touch interactions

### Client Management
- Search functionality
- Client profiles
- Contact information
- Appointment history

### Appointments
- Real-time status updates
- Action buttons (confirm, complete, cancel)
- Service and staff information
- Notes and pricing

## 🎨 Design System

- **Colors**: Blue (#3B82F6) and Purple (#8B5CF6) gradients
- **Typography**: System fonts with proper hierarchy
- **Spacing**: 8px grid system
- **Components**: Glassmorphism cards with blur effects
- **Icons**: Ionicons for consistent iconography

## 🔄 Real-time Features

The app uses Supabase real-time subscriptions for:
- Live appointment updates
- Client information changes
- Staff availability updates

## 🚀 Deployment

### Expo Build

```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android
```

### EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Configure EAS
eas build:configure

# Build for both platforms
eas build --platform all
```

## 🔧 Environment Variables

Required environment variables:

- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## 📝 API Integration

The app integrates with Supabase for:

- **Authentication**: User management and sessions
- **Database**: CRUD operations on all entities
- **Real-time**: Live updates and subscriptions
- **Storage**: Future file upload capabilities

## 🛡️ Security

- Row Level Security (RLS) enabled on all tables
- User-based data isolation
- Secure authentication with JWT tokens
- Environment variables for sensitive data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the documentation
- Open an issue on GitHub
- Contact the development team

---

**Poltrona** - Professional barbershop management in your pocket! ✂️📱