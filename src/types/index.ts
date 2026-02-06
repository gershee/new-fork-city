// User types
export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

// List types
export interface List {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  emoji_icon: string;
  color: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  profile?: Profile;
  pins_count?: number;
  likes_count?: number;
}

// Pin types
export interface Pin {
  id: string;
  list_id: string;
  user_id: string;
  place_id: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string | null;
  personal_rating: number | null;
  personal_notes: string | null;
  is_visited: boolean;
  created_at: string;
  // Joined data
  photos?: PinPhoto[];
  list?: List;
  owner?: Profile;
}

export interface PinPhoto {
  id: string;
  pin_id: string;
  url: string;
  created_at: string;
}

// Social types
export interface ListLike {
  user_id: string;
  list_id: string;
  created_at: string;
}

export interface PinLike {
  user_id: string;
  pin_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  pin_id: string | null;
  list_id: string | null;
  content: string;
  created_at: string;
  // Joined data
  profile?: Profile;
}

// Map layer types
export interface MapLayer {
  id: string;
  user_id: string;
  list_id: string;
  enabled: boolean;
  // Joined data
  list?: List;
  profile?: Profile;
}

// GeoJSON types for Mapbox
export interface PinFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: string;
    name: string;
    color: string;
    emoji: string;
    listId: string;
    listName: string;
    userId: string;
    isVisited: boolean;
    rating: number | null;
  };
}

export interface PinFeatureCollection {
  type: "FeatureCollection";
  features: PinFeature[];
}
