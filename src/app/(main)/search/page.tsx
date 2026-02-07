"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button, BottomSheet, Avatar } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { List, Pin, Profile } from "@/types";

type SearchTab = "places" | "users" | "lists";

interface ExistingPin {
  pin: Pin;
  list: List;
  owner: Profile;
}

interface PlaceResult {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
  properties: {
    category?: string;
    address?: string;
  };
  context?: Array<{
    id: string;
    text: string;
  }>;
  mapbox_id?: string;
}

interface UserResult extends Profile {
  followers_count: number;
  lists_count: number;
}

interface ListResult extends List {
  pins_count: number;
  profile: Profile;
}

export default function SearchPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SearchTab>("places");
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Places state
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [myLists, setMyLists] = useState<List[]>([]);
  const [recentSearches, setRecentSearches] = useState<PlaceResult[]>([]);
  const [existingPins, setExistingPins] = useState<ExistingPin[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Users state
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserResult[]>([]);

  // Lists state
  const [listResults, setListResults] = useState<ListResult[]>([]);
  const [suggestedLists, setSuggestedLists] = useState<ListResult[]>([]);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("lists")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });
        if (data) setMyLists(data);
      }

      const saved = localStorage.getItem("new-fork-city-recent-searches");
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved));
        } catch {}
      }
    };
    loadData();
  }, []);

  // Load suggested users and lists
  useEffect(() => {
    const loadSuggestions = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Fetch all users (we'll filter current user in JS if needed)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .limit(30);

      if (profiles) {
        const usersWithStats = await Promise.all(
          profiles
            .filter(p => p.id !== currentUserId) // Exclude current user
            .map(async (profile) => {
              const [followersResult, listsResult] = await Promise.all([
                supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
                supabase.from("lists").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
              ]);
              return {
                ...profile,
                followers_count: followersResult.count || 0,
                lists_count: listsResult.count || 0,
              };
            })
        );
        // Sort by lists count first (users with content), then by followers
        const sorted = usersWithStats
          .filter(u => u.lists_count > 0) // Only show users with lists
          .sort((a, b) => (b.lists_count + b.followers_count) - (a.lists_count + a.followers_count))
          .slice(0, 10);
        setSuggestedUsers(sorted);
      }

      // Fetch all lists with pins
      const { data: lists } = await supabase
        .from("lists")
        .select(`*, profile:profiles!user_id(id, username, display_name, avatar_url), pins!list_id(id), likes:list_likes!list_id(id)`)
        .order("updated_at", { ascending: false })
        .limit(30);

      if (lists && lists.length > 0) {
        const listsWithCounts = lists
          .filter((list: any) => list.user_id !== currentUserId) // Exclude current user's lists
          .map((list: any) => ({
            ...list,
            pins_count: Array.isArray(list.pins) ? list.pins.length : 0,
            likes_count: Array.isArray(list.likes) ? list.likes.length : 0,
          }));
        // Sort by pins count (lists with content), then by likes
        const sorted = listsWithCounts
          .sort((a: any, b: any) => (b.pins_count + b.likes_count) - (a.pins_count + a.likes_count))
          .slice(0, 10);
        setSuggestedLists(sorted);
      }
    };
    loadSuggestions();
  }, []);

  // Debounced search
  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!searchQuery.trim()) {
      setPlaceResults([]);
      setUserResults([]);
      setListResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      const supabase = createClient();

      try {
        // Search based on active tab
        if (activeTab === "places") {
          await searchPlaces(searchQuery);
        } else if (activeTab === "users") {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
            .limit(20);

          if (data) {
            const usersWithStats = await Promise.all(
              data.map(async (profile) => {
                const [followersResult, listsResult] = await Promise.all([
                  supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
                  supabase.from("lists").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
                ]);
                return {
                  ...profile,
                  followers_count: followersResult.count || 0,
                  lists_count: listsResult.count || 0,
                };
              })
            );
            setUserResults(usersWithStats);
          }
        } else if (activeTab === "lists") {
          const { data } = await supabase
            .from("lists")
            .select(`*, profile:profiles!user_id(id, username, display_name, avatar_url), pins!list_id(id)`)
            .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
            .limit(20);

          if (data) {
            const listsWithCount = data.map((list: any) => ({
              ...list,
              pins_count: Array.isArray(list.pins) ? list.pins.length : 0,
            }));
            setListResults(listsWithCount);
          }
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [activeTab]);

  const searchPlaces = async (searchQuery: string) => {
    try {
      const sessionToken = crypto.randomUUID();
      const response = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(searchQuery)}&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&session_token=${sessionToken}&proximity=-73.985428,40.748817&limit=10&types=poi,address&poi_category=restaurant,bar,cafe,food,nightlife,coffee,bakery,fast_food,pub`
      );
      const data = await response.json();
      const suggestions = data.suggestions || [];
      const transformedResults: PlaceResult[] = suggestions.map((s: any) => ({
        id: s.mapbox_id,
        place_name: s.full_address || s.address || s.place_formatted || "",
        text: s.name,
        center: [0, 0] as [number, number],
        properties: { category: s.poi_category?.join(", ") || "", address: s.address },
        context: s.context ? [{ id: "neighborhood", text: s.context?.neighborhood?.name || "" }] : [],
        mapbox_id: s.mapbox_id,
      }));
      setPlaceResults(transformedResults);
    } catch {
      setPlaceResults([]);
    }
  };

  // Re-search when tab changes
  useEffect(() => {
    if (query.trim()) {
      handleSearch(query);
    }
  }, [activeTab]);

  const handleSelectPlace = async (place: PlaceResult) => {
    if (place.mapbox_id && place.center[0] === 0 && place.center[1] === 0) {
      try {
        const response = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/retrieve/${place.mapbox_id}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&session_token=${crypto.randomUUID()}`
        );
        const data = await response.json();
        if (data.features?.[0]) {
          const feature = data.features[0];
          place = {
            ...place,
            center: feature.geometry.coordinates as [number, number],
            place_name: feature.properties.full_address || feature.properties.address || place.place_name,
          };
        }
      } catch {}
    }

    const updated = [place, ...recentSearches.filter((r) => r.id !== place.id)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("new-fork-city-recent-searches", JSON.stringify(updated));

    setSelectedPlace(place);
    setShowAddForm(false);
    setExistingPins([]);

    if (place.center[0] !== 0 && place.center[1] !== 0) {
      fetchExistingPins(place);
    }
  };

  const fetchExistingPins = async (place: PlaceResult) => {
    setIsLoadingExisting(true);
    const supabase = createClient();
    const lat = place.center[1];
    const lng = place.center[0];
    const tolerance = 0.0005;

    const { data: pinsData } = await supabase
      .from("pins")
      .select(`*, list:lists!list_id(*, profile:profiles!user_id(*))`)
      .gte("lat", lat - tolerance)
      .lte("lat", lat + tolerance)
      .gte("lng", lng - tolerance)
      .lte("lng", lng + tolerance);

    if (pinsData) {
      setExistingPins(pinsData.map((pin: any) => ({ pin, list: pin.list, owner: pin.list.profile })));
    }
    setIsLoadingExisting(false);
  };

  const handleSavePin = async (listId: string, isVisited: boolean, rating: number | null, notes: string) => {
    if (!selectedPlace) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("pins").insert({
      user_id: user.id,
      list_id: listId,
      name: selectedPlace.text,
      address: selectedPlace.place_name,
      lat: selectedPlace.center[1],
      lng: selectedPlace.center[0],
      category: selectedPlace.properties?.category || null,
      is_visited: isVisited,
      personal_rating: rating,
      personal_notes: notes || null,
    });

    if (!error) {
      setSelectedPlace(null);
      setQuery("");
      setPlaceResults([]);
      router.push("/explore");
    }
  };

  const tabs: { id: SearchTab; label: string; icon: string }[] = [
    { id: "places", label: "Places", icon: "📍" },
    { id: "users", label: "Users", icon: "👤" },
    { id: "lists", label: "Lists", icon: "📋" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Search Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="p-4">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              autoFocus
              className="w-full bg-surface-elevated border border-border rounded-xl pl-10 pr-10 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setPlaceResults([]);
                  setUserResults([]);
                  setListResults([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-neon-pink to-neon-purple text-white shadow-lg shadow-neon-pink/25"
                  : "bg-surface-elevated text-text-muted hover:text-text-primary"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="p-4">
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Places Tab */}
        {activeTab === "places" && !isSearching && (
          <>
            {placeResults.length > 0 && (
              <div className="space-y-2">
                <AnimatePresence>
                  {placeResults.map((result, index) => (
                    <motion.button
                      key={result.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleSelectPlace(result)}
                      className="w-full text-left bg-surface-elevated rounded-xl p-4 hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-neon-pink/20 flex items-center justify-center shrink-0">
                          <span className="text-lg">📍</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-text-primary truncate">{result.text}</h3>
                          <p className="text-sm text-text-secondary truncate">{result.place_name}</p>
                          {result.properties?.category && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-text-muted mt-1 inline-block">
                              {result.properties.category.split(",")[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {!query && recentSearches.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-text-secondary mb-3">Recent Searches</h2>
                <div className="space-y-2">
                  {recentSearches.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => handleSelectPlace(place)}
                      className="w-full text-left bg-surface-elevated rounded-xl p-4 hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <HistoryIcon className="w-5 h-5 text-text-muted" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-text-primary truncate">{place.text}</h3>
                          <p className="text-sm text-text-secondary truncate">{place.place_name}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {query && placeResults.length === 0 && (
              <div className="text-center py-12">
                <p className="text-text-muted">No places found</p>
              </div>
            )}

            {!query && recentSearches.length === 0 && (
              <div className="text-center py-12">
                <SearchIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <p className="text-text-secondary">Search for restaurants, bars, cafes, and more</p>
              </div>
            )}
          </>
        )}

        {/* Users Tab */}
        {activeTab === "users" && !isSearching && (
          <>
            {userResults.length > 0 && (
              <div className="space-y-2">
                <AnimatePresence>
                  {userResults.map((user, index) => (
                    <motion.button
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => router.push(`/user/${user.username}`)}
                      className="w-full text-left bg-surface-elevated rounded-xl p-4 hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={user.avatar_url}
                          alt={user.display_name || user.username}
                          fallback={(user.display_name || user.username)?.[0]}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-text-primary truncate">
                            {user.display_name || user.username}
                          </h3>
                          <p className="text-sm text-text-muted">@{user.username}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-text-secondary">
                              <span className="font-medium text-text-primary">{user.followers_count}</span> followers
                            </span>
                            <span className="text-xs text-text-secondary">
                              <span className="font-medium text-text-primary">{user.lists_count}</span> lists
                            </span>
                          </div>
                        </div>
                        <ChevronRightIcon />
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {query && userResults.length === 0 && (
              <div className="text-center py-12">
                <p className="text-text-muted">No users found</p>
              </div>
            )}

            {!query && suggestedUsers.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🔥</span>
                  <h2 className="text-sm font-medium text-text-secondary">Top Foodies</h2>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {suggestedUsers.map((user, index) => (
                      <motion.button
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => router.push(`/user/${user.username}`)}
                        className="w-full text-left bg-surface-elevated rounded-xl p-4 hover:bg-surface-hover transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar
                              src={user.avatar_url}
                              alt={user.display_name || user.username}
                              fallback={(user.display_name || user.username)?.[0]}
                              size="md"
                            />
                            {index < 3 && (
                              <span className="absolute -top-1 -right-1 text-sm">
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-text-primary truncate">
                              {user.display_name || user.username}
                            </h3>
                            <p className="text-sm text-text-muted">@{user.username}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-text-secondary">
                                <span className="font-medium text-neon-pink">{user.followers_count}</span> followers
                              </span>
                              <span className="text-xs text-text-secondary">
                                <span className="font-medium text-neon-cyan">{user.lists_count}</span> lists
                              </span>
                            </div>
                          </div>
                          <ChevronRightIcon />
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {!query && suggestedUsers.length === 0 && (
              <div className="text-center py-12">
                <span className="text-4xl mb-4 block">👤</span>
                <p className="text-text-secondary">Search for users by name or username</p>
              </div>
            )}
          </>
        )}

        {/* Lists Tab */}
        {activeTab === "lists" && !isSearching && (
          <>
            {listResults.length > 0 && (
              <div className="space-y-2">
                <AnimatePresence>
                  {listResults.map((list, index) => (
                    <motion.button
                      key={list.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => router.push(`/lists/${list.id}`)}
                      className="w-full text-left bg-surface-elevated rounded-xl p-4 hover:bg-surface-hover transition-colors relative overflow-hidden"
                    >
                      <div
                        className="absolute top-0 left-0 right-0 h-1"
                        style={{ backgroundColor: list.color }}
                      />
                      <div className="flex items-start gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                          style={{ backgroundColor: `${list.color}20` }}
                        >
                          {list.emoji_icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-text-primary truncate">{list.name}</h3>
                          {list.description && (
                            <p className="text-sm text-text-secondary truncate">{list.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs bg-surface px-2 py-0.5 rounded-full text-text-muted">
                              {list.pins_count} {list.pins_count === 1 ? "spot" : "spots"}
                            </span>
                          </div>
                          {/* Creator */}
                          <div className="flex items-center gap-2 mt-2">
                            <Avatar
                              src={list.profile?.avatar_url}
                              alt={list.profile?.display_name || list.profile?.username}
                              fallback={(list.profile?.display_name || list.profile?.username)?.[0]}
                              size="xs"
                            />
                            <span className="text-xs text-text-muted">
                              @{list.profile?.username}
                            </span>
                          </div>
                        </div>
                        <ChevronRightIcon />
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {query && listResults.length === 0 && (
              <div className="text-center py-12">
                <p className="text-text-muted">No lists found</p>
              </div>
            )}

            {!query && suggestedLists.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📈</span>
                  <h2 className="text-sm font-medium text-text-secondary">Trending Lists</h2>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {suggestedLists.map((list, index) => (
                      <motion.button
                        key={list.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => router.push(`/lists/${list.id}`)}
                        className="w-full text-left bg-surface-elevated rounded-xl p-4 hover:bg-surface-hover transition-colors relative overflow-hidden"
                      >
                        <div
                          className="absolute top-0 left-0 right-0 h-1"
                          style={{ backgroundColor: list.color }}
                        />
                        {index < 3 && (
                          <span className="absolute top-2 right-2 text-sm">
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                          </span>
                        )}
                        <div className="flex items-start gap-3">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                            style={{ backgroundColor: `${list.color}20` }}
                          >
                            {list.emoji_icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-text-primary truncate">{list.name}</h3>
                            {list.description && (
                              <p className="text-sm text-text-secondary truncate">{list.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs bg-surface px-2 py-0.5 rounded-full text-text-muted">
                                📍 {list.pins_count} {list.pins_count === 1 ? "spot" : "spots"}
                              </span>
                              {(list as any).likes_count > 0 && (
                                <span className="text-xs bg-neon-pink/10 px-2 py-0.5 rounded-full text-neon-pink">
                                  ❤️ {(list as any).likes_count}
                                </span>
                              )}
                            </div>
                            {/* Creator */}
                            <div className="flex items-center gap-2 mt-2">
                              <Avatar
                                src={list.profile?.avatar_url}
                                alt={list.profile?.display_name || list.profile?.username}
                                fallback={(list.profile?.display_name || list.profile?.username)?.[0]}
                                size="xs"
                              />
                              <span className="text-xs text-text-muted">
                                @{list.profile?.username}
                              </span>
                            </div>
                          </div>
                          <ChevronRightIcon />
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {!query && suggestedLists.length === 0 && (
              <div className="text-center py-12">
                <span className="text-4xl mb-4 block">📋</span>
                <p className="text-text-secondary">Search for public lists</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Place Details Sheet */}
      <BottomSheet
        isOpen={selectedPlace !== null}
        onClose={() => {
          setSelectedPlace(null);
          setShowAddForm(false);
        }}
        title={selectedPlace?.text}
      >
        {selectedPlace && !showAddForm && (
          <PlaceDetails
            place={selectedPlace}
            existingPins={existingPins}
            isLoading={isLoadingExisting}
            onAddToList={() => setShowAddForm(true)}
            onViewList={(listId) => {
              setSelectedPlace(null);
              router.push(`/lists/${listId}`);
            }}
          />
        )}
        {selectedPlace && showAddForm && (
          <SavePinForm
            place={selectedPlace}
            lists={myLists}
            onSave={handleSavePin}
            onCancel={() => setShowAddForm(false)}
            onListCreated={(newList) => setMyLists((prev) => [newList, ...prev])}
          />
        )}
      </BottomSheet>
    </div>
  );
}

type SortOption = "saves" | "rating" | "recent";

function PlaceDetails({
  place,
  existingPins,
  isLoading,
  onAddToList,
  onViewList,
}: {
  place: PlaceResult;
  existingPins: ExistingPin[];
  isLoading: boolean;
  onAddToList: () => void;
  onViewList: (listId: string) => void;
}) {
  const [sortBy, setSortBy] = useState<SortOption>("saves");

  const saveCount = existingPins.length;
  const avgRating = existingPins.length > 0
    ? existingPins.reduce((sum, { pin }) => sum + (pin.personal_rating || 0), 0) / existingPins.filter(p => p.pin.personal_rating).length || 0
    : 0;
  const visitedCount = existingPins.filter(({ pin }) => pin.is_visited).length;

  const sortedPins = useMemo(() => {
    const pins = [...existingPins];
    switch (sortBy) {
      case "rating":
        return pins.sort((a, b) => (b.pin.personal_rating || 0) - (a.pin.personal_rating || 0));
      case "recent":
        return pins.sort((a, b) => new Date(b.pin.created_at).getTime() - new Date(a.pin.created_at).getTime());
      default:
        return pins;
    }
  }, [existingPins, sortBy]);

  const uniqueLists = useMemo(() => {
    const listMap = new Map<string, { list: List; count: number }>();
    existingPins.forEach(({ list }) => {
      if (!listMap.has(list.id)) {
        listMap.set(list.id, { list, count: 1 });
      } else {
        listMap.get(list.id)!.count++;
      }
    });
    return Array.from(listMap.values());
  }, [existingPins]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-text-secondary">{place.place_name}</p>
        {place.properties?.category && (
          <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-surface text-text-muted">
            {place.properties.category.split(",")[0]}
          </span>
        )}
      </div>

      {!isLoading && saveCount > 0 && (
        <div className="bg-surface rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-bold text-neon-pink">{saveCount}</p>
                <p className="text-xs text-text-muted">saves</p>
              </div>
              {avgRating > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-neon-orange">{avgRating.toFixed(1)}★</p>
                  <p className="text-xs text-text-muted">avg rating</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-lg font-bold text-neon-green">{visitedCount}</p>
                <p className="text-xs text-text-muted">visited</p>
              </div>
            </div>
            {saveCount >= 5 && <span className="text-2xl">🔥</span>}
          </div>
        </div>
      )}

      {!isLoading && uniqueLists.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-2">
            On {uniqueLists.length} {uniqueLists.length === 1 ? "list" : "lists"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {uniqueLists.slice(0, 5).map(({ list }) => (
              <button
                key={list.id}
                onClick={() => onViewList(list.id)}
                className="px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 bg-surface-elevated hover:bg-surface-hover transition-colors"
                style={{ borderColor: list.color, borderWidth: 1 }}
              >
                <span>{list.emoji_icon}</span>
                <span>{list.name}</span>
              </button>
            ))}
            {uniqueLists.length > 5 && (
              <span className="px-2 py-1.5 text-xs text-text-muted">+{uniqueLists.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-secondary">Saved by</h3>
          {existingPins.length > 1 && (
            <div className="flex gap-1">
              {(["saves", "rating", "recent"] as SortOption[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setSortBy(option)}
                  className={`px-2 py-1 rounded-md text-xs transition-colors ${
                    sortBy === option ? "bg-neon-pink text-white" : "bg-surface text-text-muted hover:text-text-primary"
                  }`}
                >
                  {option === "saves" ? "Popular" : option === "rating" ? "Rating" : "Recent"}
                </button>
              ))}
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : existingPins.length === 0 ? (
          <div className="text-center py-4 bg-surface rounded-xl">
            <p className="text-2xl mb-2">✨</p>
            <p className="text-sm text-text-muted">Be the first to save this place!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPins.map(({ pin, list, owner }) => (
              <button
                key={pin.id}
                onClick={() => onViewList(list.id)}
                className="w-full flex items-center gap-3 p-3 bg-surface rounded-[--radius-md] hover:bg-surface-hover transition-colors text-left"
              >
                <Avatar
                  src={owner.avatar_url}
                  alt={owner.display_name || owner.username}
                  fallback={(owner.display_name || owner.username)?.[0]}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">{owner.display_name || owner.username}</p>
                  <p className="text-sm text-text-muted truncate">{list.emoji_icon} {list.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {pin.personal_rating && <span className="text-sm text-neon-orange">{"★".repeat(pin.personal_rating)}</span>}
                  {pin.is_visited && <span className="text-xs px-1.5 py-0.5 rounded bg-neon-green/20 text-neon-green">✓</span>}
                </div>
                <ChevronRightIcon />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.center[1]},${place.center[0]}`, "_blank")}
        >
          <DirectionsIcon />
          Directions
        </Button>
        <Button variant="primary" className="flex-1" onClick={onAddToList}>
          <PlusIcon />
          Save
        </Button>
      </div>
    </div>
  );
}

const EMOJI_OPTIONS = ["📍", "🍕", "🍔", "🍜", "🍣", "🍷", "🍺", "☕", "🍰", "🌮"];
const COLOR_OPTIONS = ["#ff2d92", "#00f0ff", "#b14eff", "#39ff14", "#ff6b35", "#ffd700", "#ff6b6b", "#4ecdc4"];

function SavePinForm({
  place,
  lists,
  onSave,
  onCancel,
  onListCreated,
}: {
  place: PlaceResult;
  lists: List[];
  onSave: (listId: string, isVisited: boolean, rating: number | null, notes: string) => void;
  onCancel: () => void;
  onListCreated?: (list: List) => void;
}) {
  const [selectedListId, setSelectedListId] = useState(lists[0]?.id || "new");
  const [isVisited, setIsVisited] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListEmoji, setNewListEmoji] = useState("📍");
  const [newListColor, setNewListColor] = useState("#ff2d92");

  const handleSubmit = async () => {
    setIsLoading(true);
    if (selectedListId === "new") {
      if (!newListName.trim()) { setIsLoading(false); return; }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      const { data: newList, error } = await supabase
        .from("lists")
        .insert({ user_id: user.id, name: newListName.trim(), emoji_icon: newListEmoji, color: newListColor, is_public: true })
        .select().single();

      if (error || !newList) { setIsLoading(false); return; }
      onListCreated?.(newList);
      await onSave(newList.id, isVisited, rating, notes);
    } else {
      await onSave(selectedListId, isVisited, rating, notes);
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-text-secondary text-sm">{place.place_name}</p>

      <div>
        <label className="block text-sm text-text-secondary mb-1.5">Add to list</label>
        <div className="flex flex-wrap gap-2">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => setSelectedListId(list.id)}
              className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors ${
                selectedListId === list.id ? "bg-neon-pink text-white" : "bg-surface-elevated text-text-primary border border-border"
              }`}
            >
              <span>{list.emoji_icon}</span><span>{list.name}</span>
            </button>
          ))}
          <button
            onClick={() => setSelectedListId("new")}
            className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors ${
              selectedListId === "new" ? "bg-neon-cyan text-white" : "bg-surface-elevated text-text-primary border border-border border-dashed"
            }`}
          >
            <span>+</span><span>New list</span>
          </button>
        </div>
      </div>

      {selectedListId === "new" && (
        <div className="space-y-3 p-3 bg-surface rounded-xl">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="List name..."
            className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-cyan"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Icon:</span>
            <div className="flex flex-wrap gap-1">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => setNewListEmoji(e)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${newListEmoji === e ? "bg-neon-cyan/20 ring-1 ring-neon-cyan" : "bg-surface-elevated"}`}
                >{e}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Color:</span>
            <div className="flex gap-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewListColor(c)}
                  className={`w-6 h-6 rounded-full ${newListColor === c ? "ring-2 ring-white ring-offset-1 ring-offset-surface" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm text-text-secondary mb-1.5">Status</label>
        <div className="flex gap-2">
          <button onClick={() => setIsVisited(false)} className={`flex-1 px-4 py-2 rounded-xl text-sm transition-colors ${!isVisited ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan" : "bg-surface-elevated text-text-secondary border border-border"}`}>Want to try</button>
          <button onClick={() => setIsVisited(true)} className={`flex-1 px-4 py-2 rounded-xl text-sm transition-colors ${isVisited ? "bg-neon-green/20 text-neon-green border border-neon-green" : "bg-surface-elevated text-text-secondary border border-border"}`}>Been here</button>
        </div>
      </div>

      {isVisited && (
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setRating(rating === star ? null : star)} className={`text-2xl transition-colors ${rating && star <= rating ? "text-neon-orange" : "text-text-muted"}`}>★</button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm text-text-secondary mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel}><BackIcon /></Button>
        <Button variant="primary" className="flex-1" onClick={handleSubmit} isLoading={isLoading} disabled={selectedListId === "new" ? !newListName.trim() : !selectedListId}>
          {selectedListId === "new" ? "Create & Save" : "Save to List"}
        </Button>
      </div>
    </div>
  );
}

function BackIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>; }
function SearchIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>; }
function CloseIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>; }
function HistoryIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>; }
function ChevronRightIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted shrink-0"><path d="m9 18 6-6-6-6" /></svg>; }
function DirectionsIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5"><path d="M3 11l19-9-9 19-2-8-8-2z" /></svg>; }
function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1.5"><path d="M12 5v14M5 12h14" /></svg>; }
