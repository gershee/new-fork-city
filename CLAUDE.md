# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NYC.fun is a mobile-first PWA for saving, curating, and sharing locations via custom lists with social map overlay capabilities. Users can create lists (e.g., "Best Pizza"), save pins with photos/ratings/notes, follow friends, and overlay their lists on their own map view.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4 + Framer Motion
- **Maps**: Mapbox GL JS
- **Backend**: Supabase (Postgres, Auth, Realtime, Storage)
- **Auth**: Social login (Google, Apple) via Supabase

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Start production server
npm start

# Lint
npm run lint
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx             # Landing page (redirects logged-in users to /explore)
│   ├── (auth)/login/        # Login page with social auth
│   ├── auth/callback/       # OAuth callback handler
│   └── (main)/              # Main app (protected routes)
│       ├── layout.tsx       # Includes BottomNav
│       ├── explore/         # Map view (home)
│       ├── search/          # Place search
│       ├── lists/           # Lists management
│       │   └── [id]/        # List detail view
│       ├── layers/          # Map layer toggles
│       └── profile/         # User profile
├── components/
│   ├── ui/                  # Base UI (Button, BottomNav, BottomSheet)
│   └── map/                 # MapView component
├── lib/
│   └── supabase/            # Supabase clients (client.ts, server.ts, middleware.ts)
├── types/                   # TypeScript definitions
└── middleware.ts            # Auth session refresh

supabase/
└── schema.sql               # Database schema with RLS policies
```

## Architecture Notes

### Authentication Flow
- Social auth (Google/Apple) via Supabase OAuth
- Session managed in middleware (`src/middleware.ts`)
- Protected routes: `/explore`, `/search`, `/lists`, `/profile`, `/layers`
- Auth callback at `/auth/callback`
- Landing page (`/`) redirects authenticated users to `/explore`

### Database Schema
- `profiles` - User profiles (extends auth.users)
- `follows` - Social graph
- `lists` - User-created location lists
- `pins` - Saved locations within lists
- `pin_photos` - Photos attached to pins
- `list_likes`, `pin_likes`, `comments` - Social engagement

All tables have Row Level Security (RLS) policies defined in `supabase/schema.sql`.

### Styling Conventions
- Dark theme with neon accent colors (pink: `#ff2d92`, cyan: `#00f0ff`, purple: `#b14eff`)
- CSS variables defined in `globals.css` under `:root`
- Use Tailwind classes like `bg-surface`, `text-text-primary`, `border-border`
- Neon glow utilities: `neon-glow-pink`, `neon-glow-cyan`, `text-glow-pink`
- Gradient text: `gradient-text` class

### Component Patterns
- UI components in `src/components/ui/` are client components with `"use client"`
- Use Framer Motion for animations (`motion.div`, `AnimatePresence`)
- Bottom sheets for mobile modals (`BottomSheet` component)
- Bottom navigation for main app navigation (`BottomNav` component)

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Mapbox access token
