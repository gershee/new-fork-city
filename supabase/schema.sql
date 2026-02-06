-- NYC.fun Database Schema
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- FOLLOWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Policies for follows
CREATE POLICY "Follows are viewable by everyone"
  ON follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow others"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ============================================
-- LISTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS lists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  emoji_icon TEXT DEFAULT '📍' NOT NULL,
  color TEXT DEFAULT '#ff2d92' NOT NULL,
  is_public BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100)
);

-- Enable RLS
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

-- Policies for lists
CREATE POLICY "Public lists are viewable by everyone"
  ON lists FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create lists"
  ON lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists"
  ON lists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists"
  ON lists FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- PINS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  place_id TEXT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  category TEXT,
  personal_rating INTEGER CHECK (personal_rating >= 1 AND personal_rating <= 5),
  personal_notes TEXT,
  is_visited BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 200)
);

-- Enable RLS
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- Policies for pins
CREATE POLICY "Pins are viewable if list is public or owned"
  ON pins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = pins.list_id
      AND (lists.is_public = true OR lists.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create pins in their own lists"
  ON pins FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id
      AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own pins"
  ON pins FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pins"
  ON pins FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- PIN PHOTOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pin_photos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pin_id UUID REFERENCES pins(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE pin_photos ENABLE ROW LEVEL SECURITY;

-- Policies for pin_photos
CREATE POLICY "Pin photos are viewable if pin is viewable"
  ON pin_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pins
      JOIN lists ON lists.id = pins.list_id
      WHERE pins.id = pin_photos.pin_id
      AND (lists.is_public = true OR lists.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can add photos to their own pins"
  ON pin_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pins
      WHERE pins.id = pin_id
      AND pins.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own pin photos"
  ON pin_photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM pins
      WHERE pins.id = pin_id
      AND pins.user_id = auth.uid()
    )
  );

-- ============================================
-- LIST LIKES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS list_likes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  PRIMARY KEY (user_id, list_id)
);

-- Enable RLS
ALTER TABLE list_likes ENABLE ROW LEVEL SECURITY;

-- Policies for list_likes
CREATE POLICY "List likes are viewable by everyone"
  ON list_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like lists"
  ON list_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike lists"
  ON list_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- PIN LIKES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pin_likes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  pin_id UUID REFERENCES pins(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  PRIMARY KEY (user_id, pin_id)
);

-- Enable RLS
ALTER TABLE pin_likes ENABLE ROW LEVEL SECURITY;

-- Policies for pin_likes
CREATE POLICY "Pin likes are viewable by everyone"
  ON pin_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like pins"
  ON pin_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike pins"
  ON pin_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  pin_id UUID REFERENCES pins(id) ON DELETE CASCADE,
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 1000),
  CONSTRAINT must_have_one_target CHECK (
    (pin_id IS NOT NULL AND list_id IS NULL) OR
    (pin_id IS NULL AND list_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Policies for comments
CREATE POLICY "Comments are viewable if target is viewable"
  ON comments FOR SELECT
  USING (
    (pin_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM pins
      JOIN lists ON lists.id = pins.list_id
      WHERE pins.id = comments.pin_id
      AND (lists.is_public = true OR lists.user_id = auth.uid())
    ))
    OR
    (list_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = comments.list_id
      AND (lists.is_public = true OR lists.user_id = auth.uid())
    ))
  );

CREATE POLICY "Users can create comments"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_lists_user ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_public ON lists(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_pins_list ON pins(list_id);
CREATE INDEX IF NOT EXISTS idx_pins_user ON pins(user_id);
CREATE INDEX IF NOT EXISTS idx_pins_location ON pins(lat, lng);
CREATE INDEX IF NOT EXISTS idx_pin_photos_pin ON pin_photos(pin_id);
CREATE INDEX IF NOT EXISTS idx_comments_pin ON comments(pin_id) WHERE pin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_list ON comments(list_id) WHERE list_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_list_likes_list ON list_likes(list_id);
CREATE INDEX IF NOT EXISTS idx_pin_likes_pin ON pin_likes(pin_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for lists updated_at
CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for pins updated_at
CREATE TRIGGER update_pins_updated_at
  BEFORE UPDATE ON pins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_username TEXT;
BEGIN
  -- Try to use provided username, fall back to unique user_id based username
  new_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    'user_' || replace(NEW.id::text, '-', '')
  );

  -- Handle potential username collision by appending random suffix
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = new_username) LOOP
    new_username := 'user_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  END LOOP;

  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    new_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- Note: If buckets already exist via dashboard, these INSERTs will fail (safe to ignore)

INSERT INTO storage.buckets (id, name, public)
VALUES ('pin-photos', 'pin-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES: pin-photos bucket
-- ============================================

CREATE POLICY "Anyone can view pin photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pin-photos');

CREATE POLICY "Authenticated users can upload pin photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pin-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own pin photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'pin-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own pin photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pin-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- STORAGE POLICIES: avatars bucket
-- ============================================

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
