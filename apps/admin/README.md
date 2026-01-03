# Blanc Admin Dashboard

A modern admin dashboard for managing Blanc platform built with React, TypeScript, and Vite.

## Features

- 🔐 **Secure Authentication** - httpOnly cookie session + CSRF (legacy Bearer token supported)
- 👥 **User Management** - View, edit, ban/activate users
- 🏆 **Contest Management** - Create, edit, delete contests with AI description generation
- 📚 **Course Management** - Manage courses with AI syllabus generation
- 📊 **Dashboard Analytics** - Real-time statistics and charts
- 📝 **Audit Logs** - Track all system activities
- ⚙️ **Settings** - Configure platform settings
- 🤖 **Gemini AI Integration** - Auto-generate content descriptions

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Routing**: React Router v7
- **State Management**: React Context + Hooks
- **UI**: Tailwind CSS, Lucide React Icons
- **Charts**: Recharts
- **AI**: Google Gemini API

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Backend API running at `http://localhost:4000/api`

### Installation

```bash
# From repo root (recommended)
npm install

# Start admin dev server (http://localhost:3001)
npm run admin:dev
```

### Environment Variables

Create `apps/admin/.env.local` (see `apps/admin/.env.example`) with the following variables:

```env
# Backend API URL
VITE_API_URL=http://localhost:4000/api

# Public site base URL (for profile links)
VITE_PUBLIC_SITE_URL=http://localhost:3000
```

For AI features, set `GEMINI_API_KEY` on the backend API server (not in Vite env).

## Project Structure

```
├── components/          # React components
│   ├── AuditLog.tsx    # Audit log viewer
│   ├── ContestManager.tsx  # Contest CRUD
│   ├── CourseManager.tsx   # Course CRUD
│   ├── DashboardHome.tsx   # Main dashboard
│   ├── Layout.tsx      # App layout with sidebar
│   ├── Login.tsx       # Login page
│   ├── Settings.tsx    # Platform settings
│   └── UserManager.tsx # User management
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication state
├── hooks/              # Custom hooks
│   └── useApi.ts       # API fetching hooks
├── services/           # API services
│   ├── api.ts          # Base API client
│   ├── auditLogService.ts
│   ├── contestService.ts
│   ├── courseService.ts
│   ├── dashboardService.ts
│   ├── geminiService.ts
│   ├── settingsService.ts
│   └── userService.ts
├── types.ts            # TypeScript types
├── constants.ts        # Mock data & constants
└── App.tsx             # Main app component
```

## API Endpoints

Base URL: `${VITE_API_URL}` (default: `http://localhost:4000/api`)

- Auth: `/auth/login/initiate`, `/auth/login/verify-2fa`, `/auth/me`, `/auth/logout`
- Admin-only: `/admin/*` (users, settings, notifications, security, audit logs, email tools)
- Shared resources: `/contests`, `/courses`, `/documents`, `/news`, `/stats`

## Security Features

- **httpOnly cookie session** + **CSRF** for state-changing requests
- **Role-based access** enforced server-side (`admin`, `super_admin`)
- **Protected routes** for authenticated users only
- **CORS + credentials** enabled for cookie auth

## Development

```bash
# From repo root
npm run admin:dev
npm run admin:build
npm run admin:preview
```

## License

MIT License - see LICENSE file for details.
