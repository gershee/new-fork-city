# New Fork City - Deep Code Review Report

**Date:** 2026-02-09  
**Repository:** new-fork-city  
**Framework:** Next.js 16.1.5 + React 19.2.3 + TypeScript + Supabase + Mapbox

---

## Executive Summary

The New Fork City app is a well-structured social mapping application with good architectural patterns. However, several critical security vulnerabilities, performance bottlenecks, and missing UX features were identified that need immediate attention.

**Overall Score: 7.2/10**
- Security: 6/10 (critical issues found)
- Performance: 7/10 (bundle size concerns)
- Code Quality: 8/10 (good TypeScript, some inconsistency)
- Architecture: 8/10 (clean separation, good patterns)
- UX Completeness: 6/10 (missing critical features)

---

## 1. SECURITY AUDIT

### 🔴 CRITICAL ISSUES

#### 1.1 API Keys Exposed in Client-Side Code
**Files:** Multiple (MapView.tsx, search/page.tsx, AddPinSheet.tsx)
**Severity:** CRITICAL

**Problem:** Mapbox API token is accessed via `process.env.NEXT_PUBLIC_MAPBOX_TOKEN` but it's used directly in client-side fetch calls, making it visible in browser network requests.

```typescript
// search/page.tsx - Line ~272
const response = await fetch(
  `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(searchQuery)}&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&session_token=${sessionToken}...`
);
```

**Recommendation:** 
- Create a Next.js API route to proxy Mapbox requests
- Store the token server-side only
- Implement rate limiting on the proxy

```typescript
// app/api/mapbox/search/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  const response = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/suggest?q=${query}&access_token=${process.env.MAPBOX_SECRET_TOKEN}...`,
    { next: { revalidate: 60 } }
  );
  
  return Response.json(await response.json());
}
```

#### 1.2 Missing Input Sanitization
**Files:** Multiple form submissions
**Severity:** HIGH

**Problem:** User inputs (notes, names, addresses) are stored directly without sanitization, creating potential XSS vectors:

```typescript
// EditPinForm.tsx - Lines 28-33
const [notes, setNotes] = useState(pin.personal_notes || "");
// ... later inserted directly into Supabase
personal_notes: notes.trim() || null,
```

**Recommendation:**
- Use DOMPurify for any rendered user content
- Implement server-side sanitization in Supabase RLS or Edge Functions

```typescript
import DOMPurify from 'isomorphic-dompurify';

const sanitizedNotes = DOMPurify.sanitize(notes.trim());
```

#### 1.3 No Rate Limiting
**Files:** All API routes and Supabase calls
**Severity:** MEDIUM

**Problem:** No rate limiting exists for:
- Search queries
- Pin creation/updates
- List creation
- Follow/unfollow actions

**Recommendation:**
- Implement Vercel KV or Upstash for rate limiting
- Add Supabase Edge Function rate limiting

### 🟡 MEDIUM ISSUES

#### 1.4 Missing CSRF Protection on OAuth
**File:** `src/app/(auth)/login/page.tsx`
**Severity:** MEDIUM

The OAuth callback doesn't validate the `state` parameter, making it vulnerable to CSRF attacks.

**Recommendation:**
```typescript
// Generate and validate state parameter
const state = crypto.randomUUID();
sessionStorage.setItem('oauth_state', state);

await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: { state }
  },
});
```

#### 1.5 Service Role Key in Seed Script
**File:** `scripts/seed-users.ts`
**Severity:** MEDIUM

The seed script requires `SUPABASE_SERVICE_ROLE_KEY` which has full database access. This is dangerous if the .env file leaks.

**Recommendation:**
- Add `.env.local` to `.gitignore` (already done ✓)
- Document that service role should never be used in production client code
- Add a warning comment in the seed script

---

## 2. PERFORMANCE ANALYSIS

### 🔴 CRITICAL ISSUES

#### 2.1 Bundle Size Concerns
**Files:** Multiple
**Severity:** HIGH

**Issues:**
1. **Mapbox GL JS** (~800KB+) is loaded on every page even when not needed
2. **Framer Motion** loaded globally despite only being used in specific components
3. **date-fns** imports may not be tree-shaken properly

**Evidence:**
```typescript
// layout.tsx loads these globally
import { Space_Grotesk, Geist_Mono } from "next/font/google";
```

**Recommendation:**
- Use dynamic imports for Mapbox:
```typescript
const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => <MapSkeleton />
});
```

- Implement route-based code splitting for heavy components

#### 2.2 N+1 Query Pattern in Search
**File:** `src/app/(main)/search/page.tsx` - Lines 148-160
**Severity:** HIGH

```typescript
const usersWithStats = await Promise.all(
  profiles
    .filter(p => p.id !== currentUserId)
    .map(async (profile) => {
      const [followersResult, listsResult] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
        supabase.from("lists").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
      ]);
      // ...
    })
);
```

**Problem:** For each user profile, 2 additional queries are made. With 30 users, that's 61 total queries.

**Recommendation:**
- Use Supabase RPC functions with joins
- Or denormalize counts into profiles table with triggers

```sql
-- Add computed columns to profiles
ALTER TABLE profiles ADD COLUMN followers_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN lists_count INT DEFAULT 0;

-- Update with triggers
CREATE OR REPLACE FUNCTION update_profile_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles 
  SET followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = NEW.following_id)
  WHERE id = NEW.following_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 2.3 Missing Image Optimization
**Files:** Avatar.tsx, seed-users.ts
**Severity:** MEDIUM

External avatar URLs are not optimized:
```typescript
// seed-users.ts
avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=pete",
```

**Recommendation:**
- Use Next.js Image component with external domains configured
- Implement image proxy for external images

### 🟡 MEDIUM ISSUES

#### 2.4 Unoptimized Re-renders
**File:** `src/app/(main)/lists/page.tsx`
**Severity:** MEDIUM

The `fetchPinsForList` callback changes reference on every render:
```typescript
const fetchPinsForList = useCallback(async (listId: string) => {
  // ... uses listPins state which changes frequently
}, [listPins]); // This dependency causes issues
```

**Recommendation:**
- Use React Query (TanStack Query) for server state
- Implement proper cache management

#### 2.5 LocalStorage Access Without Error Handling
**File:** Multiple (explore/page.tsx, search/page.tsx)
**Severity:** MEDIUM

```typescript
const savedLayers = localStorage.getItem(ENABLED_LAYERS_KEY);
```

**Problem:** Will throw in SSR contexts and private browsing modes.

**Recommendation:**
```typescript
const getStoredLayers = () => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ENABLED_LAYERS_KEY);
  } catch (e) {
    return null;
  }
};
```

---

## 3. CODE QUALITY

### 🟢 STRENGTHS

1. **TypeScript Strictness:** `tsconfig.json` has `strict: true` enabled ✓
2. **Consistent Naming:** Good use of camelCase and descriptive names
3. **Component Architecture:** Clean separation of concerns
4. **Types Definitions:** Well-defined interfaces in `src/types/index.ts`

### 🟡 AREAS FOR IMPROVEMENT

#### 3.1 Inconsistent Error Handling
**Files:** Multiple

Some places show errors to users:
```typescript
if (error) {
  setError(error.message);
  setIsLoading(null);
}
```

Others just console.error:
```typescript
if (error) {
  console.error("Error creating pin:", error);
  setIsLoading(false);
  return;
}
```

**Recommendation:**
- Create a unified error handling utility
- Implement error boundaries

#### 3.2 Missing Type Safety on Database Queries
**File:** Multiple Supabase queries

```typescript
const { data } = await supabase
  .from("pins")
  .select(`*, list:lists(*)`)
  .eq("user_id", user.id);
// data is any[] - no type inference
```

**Recommendation:**
- Generate types from Supabase schema
- Use `supabase-js` with generated types

#### 3.3 Magic Numbers
**Files:** Multiple

```typescript
const tolerance = 0.001; // What unit? What does this represent?
const delay = index * 0.03; // Why 0.03?
```

**Recommendation:**
```typescript
const LOCATION_TOLERANCE_KM = 0.001;
const ANIMATION_STAGGER_MS = 30;
```

---

## 4. ARCHITECTURE REVIEW

### 🟢 STRENGTHS

1. **Route Groups:** Good use of `(main)` and `(auth)` route groups
2. **Supabase SSR Pattern:** Proper use of `@supabase/ssr` package
3. **Middleware:** Clean session management in `middleware.ts`
4. **Database Design:** Well-normalized schema with proper RLS policies

### 🟡 IMPROVEMENTS NEEDED

#### 4.1 Missing API Layer Abstraction
**Problem:** Direct Supabase calls scattered throughout components.

**Recommendation:** Create a service layer:
```typescript
// lib/services/pinService.ts
export const pinService = {
  async getByListId(listId: string): Promise<Pin[]> {
    const { data, error } = await supabase
      .from('pins')
      .select('*')
      .eq('list_id', listId);
    if (error) throw new PinServiceError(error);
    return data;
  },
  // ...
};
```

#### 4.2 State Management
**Problem:** Complex local state in pages, prop drilling.

**Recommendation:**
- Use Zustand for global UI state
- Use React Query for server state
- Keep local state minimal

#### 4.3 No Loading/Error Boundaries
**File:** App root

**Recommendation:**
```typescript
// app/error.tsx
'use client';
export default function ErrorBoundary({ error, reset }) {
  return <ErrorFallback error={error} onRetry={reset} />;
}
```

---

## 5. MISSING FEATURES FOR UX IMPROVEMENT

### 🔴 CRITICAL MISSING

#### 5.1 No Error Recovery
**Impact:** Users see blank screens on errors

**Solution:**
- Add retry mechanisms
- Implement offline detection
- Add optimistic UI with rollback

#### 5.2 No Loading States for Infinite Lists
**Impact:** Users don't know if more content is loading

**Solution:**
```typescript
// Implement virtual scrolling with react-window
// Add skeleton loaders for all list items
```

#### 5.3 Missing Image Upload
**Impact:** Users cannot add photos to pins

**Current:** Schema has `pin_photos` table but no UI implementation

**Recommendation:**
- Add image upload to `AddPinSheet` and `EditPinForm`
- Use Supabase Storage with proper RLS
- Implement image compression before upload

#### 5.4 No Search Debouncing
**Impact:** Excessive API calls

**Current:**
```typescript
onChange={(e) => handleSearch(e.target.value)} // Called on every keystroke
```

### 🟡 NICE TO HAVE

#### 5.5 Missing Keyboard Navigation
- No keyboard shortcuts for power users
- No focus management in modals

#### 5.6 No Dark/Light Mode Toggle
- System preference only, no manual toggle

#### 5.7 Missing Pull-to-Refresh
- Critical for mobile PWA experience

#### 5.8 No Push Notifications
- Would enhance social features

#### 5.9 Missing Share Functionality
- Cannot share lists or pins via native share API

#### 5.10 No Accessibility (a11y) Features
- Missing ARIA labels
- No focus indicators
- Poor screen reader support

---

## 6. DATABASE SCHEMA RECOMMENDATIONS

### Add These Indexes
```sql
-- Missing indexes for common queries
CREATE INDEX idx_pins_created_at ON pins(created_at DESC);
CREATE INDEX idx_lists_updated_at ON lists(updated_at DESC);
CREATE INDEX idx_profiles_username_trgm ON profiles USING gin(username gin_trgm_ops);
```

### Add Materialized View for Trending
```sql
CREATE MATERIALIZED VIEW trending_spots AS
SELECT 
  p.lat,
  p.lng,
  p.name,
  COUNT(*) as save_count,
  AVG(p.personal_rating) as avg_rating
FROM pins p
JOIN lists l ON p.list_id = l.id
WHERE l.is_public = true
GROUP BY p.lat, p.lng, p.name
HAVING COUNT(*) >= 2;

CREATE INDEX idx_trending_spots_count ON trending_spots(save_count DESC);
```

---

## 7. PRIORITY ACTION ITEMS

### Immediate (This Week)
1. ☐ Move Mapbox API calls to server-side proxy
2. ☐ Add input sanitization with DOMPurify
3. ☐ Fix N+1 query in search
4. ☐ Add error boundaries

### Short Term (Next 2 Weeks)
5. ☐ Implement image upload for pins
6. ☐ Add React Query for server state
7. ☐ Optimize bundle with dynamic imports
8. ☐ Add proper loading states

### Medium Term (Next Month)
9. ☐ Implement proper rate limiting
10. ☐ Add comprehensive test coverage
11. ☐ Improve accessibility
12. ☐ Add push notifications

---

## 8. FILE-SPECIFIC NOTES

| File | Lines | Issues |
|------|-------|--------|
| `search/page.tsx` | 600+ | N+1 queries, missing debounce, API key exposure |
| `explore/page.tsx` | 500+ | Complex state, missing error boundaries |
| `lists/page.tsx` | 700+ | Render prop complexity, unoptimized callbacks |
| `feed/page.tsx` | 500+ | N+1 queries, client-side sorting |
| `MapView.tsx` | 400+ | Token exposure, unoptimized marker updates |

---

## 9. POSITIVE HIGHLIGHTS

- ✓ Good TypeScript strict mode configuration
- ✓ Proper RLS policies in Supabase
- ✓ Clean component architecture
- ✓ Good use of modern React patterns (Suspense, hooks)
- ✓ Well-designed UI with consistent styling
- ✓ Mobile-first responsive design
- ✓ Good animation integration with Framer Motion
- ✓ Clean database schema design

---

## CONCLUSION

New Fork City is a solid foundation with good architectural decisions. The main concerns are around security (API key exposure) and performance (N+1 queries, bundle size). Addressing the immediate action items will significantly improve the app's security posture and user experience.

The codebase shows good understanding of modern React patterns and the developer has built a maintainable foundation. With the recommended improvements, this could become a production-ready application.

**Estimated effort to address critical issues: 2-3 weeks**

---

*Report generated by AI Code Review Agent*
