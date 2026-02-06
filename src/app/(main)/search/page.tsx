"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button, BottomSheet, Avatar } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { List, Pin, Profile } from "@/types";

interface ExistingPin {
  pin: Pin;
  list: List;
  owner: Profile;
}

interface SearchResult {
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
  mapbox_id?: string; // For Search Box API results
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SearchResult | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const [existingPins, setExistingPins] = useState<ExistingPin[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load lists and recent searches
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("lists")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (data) setLists(data);
      }

      // Load recent searches from localStorage
      const saved = localStorage.getItem("new-fork-city-recent-searches");
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved));
        } catch {
          // ignore
        }
      }
    };

    loadData();
  }, []);

  // Debounced search
  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);

      try {
        // Use Mapbox Search Box API for better POI/business results
        const sessionToken = crypto.randomUUID();
        const response = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(
            searchQuery
          )}&access_token=${
            process.env.NEXT_PUBLIC_MAPBOX_TOKEN
          }&session_token=${sessionToken}&proximity=-73.985428,40.748817&limit=10&types=poi,address&poi_category=restaurant,bar,cafe,food,nightlife,coffee,bakery,fast_food,pub`
        );

        const data = await response.json();

        // Transform suggestions to match our SearchResult interface
        const suggestions = data.suggestions || [];
        const transformedResults: SearchResult[] = suggestions.map((s: any) => ({
          id: s.mapbox_id,
          place_name: s.full_address || s.address || s.place_formatted || "",
          text: s.name,
          center: [0, 0] as [number, number], // Will be fetched on selection
          properties: {
            category: s.poi_category?.join(", ") || "",
            address: s.address,
          },
          context: s.context ? [{ id: "neighborhood", text: s.context?.neighborhood?.name || "" }] : [],
          // Store mapbox_id for retrieval
          mapbox_id: s.mapbox_id,
        }));

        setResults(transformedResults);
      } catch (error) {
        console.error("Search error:", error);
        // Fallback to geocoding API
        try {
          const fallbackResponse = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
              searchQuery
            )}.json?access_token=${
              process.env.NEXT_PUBLIC_MAPBOX_TOKEN
            }&proximity=-73.985428,40.748817&types=poi,address&limit=10`
          );
          const fallbackData = await fallbackResponse.json();
          setResults(fallbackData.features || []);
        } catch {
          setResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectPlace = async (place: SearchResult) => {
    // If this is from Search Box API, we need to fetch coordinates
    if (place.mapbox_id && (place.center[0] === 0 && place.center[1] === 0)) {
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
      } catch (error) {
        console.error("Error fetching place details:", error);
      }
    }

    // Save to recent searches
    const updated = [
      place,
      ...recentSearches.filter((r) => r.id !== place.id),
    ].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("new-fork-city-recent-searches", JSON.stringify(updated));

    setSelectedPlace(place);
    setShowAddForm(false);
    setExistingPins([]);

    // Fetch existing pins at this location
    if (place.center[0] !== 0 && place.center[1] !== 0) {
      fetchExistingPins(place);
    }
  };

  const fetchExistingPins = async (place: SearchResult) => {
    setIsLoadingExisting(true);
    const supabase = createClient();

    // Search for pins near this location (within ~50m) or matching name
    const lat = place.center[1];
    const lng = place.center[0];
    const tolerance = 0.0005; // roughly 50m

    const { data: pinsData } = await supabase
      .from("pins")
      .select(`
        *,
        list:lists!inner(*, profile:profiles(*))
      `)
      .eq("list.is_public", true)
      .gte("lat", lat - tolerance)
      .lte("lat", lat + tolerance)
      .gte("lng", lng - tolerance)
      .lte("lng", lng + tolerance);

    if (pinsData) {
      const existing: ExistingPin[] = pinsData.map((pin: any) => ({
        pin,
        list: pin.list,
        owner: pin.list.profile,
      }));
      setExistingPins(existing);
    }

    setIsLoadingExisting(false);
  };

  const handleSavePin = async (
    listId: string,
    isVisited: boolean,
    rating: number | null,
    notes: string
  ) => {
    if (!selectedPlace) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
      setResults([]);
      // Navigate to map centered on the new pin
      router.push("/");
    }
  };

  const getPlaceCategory = (place: SearchResult) => {
    if (place.properties?.category) {
      return place.properties.category.split(",")[0];
    }
    return null;
  };

  const getPlaceNeighborhood = (place: SearchResult) => {
    const neighborhood = place.context?.find((c) =>
      c.id.startsWith("neighborhood")
    );
    return neighborhood?.text;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Search Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border p-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for places..."
            autoFocus
            className="w-full bg-surface-elevated border border-border rounded-xl pl-10 pr-10 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink"
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="p-4">
        {/* Loading */}
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Search Results */}
        {!isSearching && results.length > 0 && (
          <div className="space-y-2">
            <AnimatePresence>
              {results.map((result, index) => (
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
                      <h3 className="font-medium text-text-primary truncate">
                        {result.text}
                      </h3>
                      <p className="text-sm text-text-secondary truncate">
                        {result.place_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {getPlaceCategory(result) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-text-muted">
                            {getPlaceCategory(result)}
                          </span>
                        )}
                        {getPlaceNeighborhood(result) && (
                          <span className="text-xs text-text-muted">
                            {getPlaceNeighborhood(result)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* No Results */}
        {!isSearching && query && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-muted">No places found</p>
          </div>
        )}

        {/* Recent Searches */}
        {!query && recentSearches.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-text-secondary mb-3">
              Recent Searches
            </h2>
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
                      <h3 className="font-medium text-text-primary truncate">
                        {place.text}
                      </h3>
                      <p className="text-sm text-text-secondary truncate">
                        {place.place_name}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!query && recentSearches.length === 0 && (
          <div className="text-center py-12">
            <SearchIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary">
              Search for restaurants, bars, cafes, and more
            </p>
          </div>
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
            lists={lists}
            onSave={handleSavePin}
            onCancel={() => setShowAddForm(false)}
            onListCreated={(newList) => {
              setLists((prev) => [newList, ...prev]);
            }}
          />
        )}
      </BottomSheet>
    </div>
  );
}

// Place Details Component
function PlaceDetails({
  place,
  existingPins,
  isLoading,
  onAddToList,
  onViewList,
}: {
  place: SearchResult;
  existingPins: ExistingPin[];
  isLoading: boolean;
  onAddToList: () => void;
  onViewList: (listId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Address & Category */}
      <div>
        <p className="text-text-secondary">{place.place_name}</p>
        {place.properties?.category && (
          <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-surface text-text-muted">
            {place.properties.category.split(",")[0]}
          </span>
        )}
      </div>

      {/* Who has saved this */}
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-2">
          Saved by
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : existingPins.length === 0 ? (
          <p className="text-sm text-text-muted py-2">
            No one you follow has saved this place yet. Be the first!
          </p>
        ) : (
          <div className="space-y-2">
            {existingPins.map(({ pin, list, owner }) => (
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
                  <p className="font-medium text-text-primary truncate">
                    {owner.display_name || owner.username}
                  </p>
                  <p className="text-sm text-text-muted truncate">
                    {list.emoji_icon} {list.name}
                    {pin.is_visited && " • Visited"}
                    {pin.personal_rating && ` • ${"★".repeat(pin.personal_rating)}`}
                  </p>
                </div>
                <ChevronRightIcon />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => {
            window.open(
              `https://www.google.com/maps/dir/?api=1&destination=${place.center[1]},${place.center[0]}`,
              "_blank"
            );
          }}
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

function DirectionsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  );
}

const EMOJI_OPTIONS = [
  "📍", "🍕", "🍔", "🍜", "🍣", "🍷", "🍺", "☕", "🍰", "🌮",
  "🥗", "🍝", "🥐", "🍦", "🎉", "❤️", "⭐", "🔥", "💎", "🌙",
];

const COLOR_OPTIONS = [
  "#ff2d92", "#00f0ff", "#b14eff", "#39ff14",
  "#ff6b35", "#ffd700", "#ff6b6b", "#4ecdc4",
];

// Save Pin Form
function SavePinForm({
  place,
  lists,
  onSave,
  onCancel,
  onListCreated,
}: {
  place: SearchResult;
  lists: List[];
  onSave: (
    listId: string,
    isVisited: boolean,
    rating: number | null,
    notes: string
  ) => void;
  onCancel: () => void;
  onListCreated?: (list: List) => void;
}) {
  const [selectedListId, setSelectedListId] = useState(lists[0]?.id || "new");
  const [isVisited, setIsVisited] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // New list form state
  const [newListName, setNewListName] = useState("");
  const [newListEmoji, setNewListEmoji] = useState("📍");
  const [newListColor, setNewListColor] = useState("#ff2d92");

  const handleSubmit = async () => {
    setIsLoading(true);

    // If creating a new list
    if (selectedListId === "new") {
      if (!newListName.trim()) {
        setIsLoading(false);
        return;
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: newList, error } = await supabase
        .from("lists")
        .insert({
          user_id: user.id,
          name: newListName.trim(),
          emoji_icon: newListEmoji,
          color: newListColor,
          is_public: false,
        })
        .select()
        .single();

      if (error || !newList) {
        console.error("Error creating list:", error);
        setIsLoading(false);
        return;
      }

      // Notify parent about new list
      onListCreated?.(newList);

      // Save pin to the new list
      await onSave(newList.id, isVisited, rating, notes);
    } else {
      await onSave(selectedListId, isVisited, rating, notes);
    }

    setIsLoading(false);
  };

  return (
    <div className="flex flex-col max-h-[70vh]">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {/* Address */}
        <p className="text-text-secondary text-sm">{place.place_name}</p>

        {/* List Selection */}
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">
            Add to list
          </label>
          <div className="flex flex-wrap gap-2">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors ${
                  selectedListId === list.id
                    ? "bg-neon-pink text-white"
                    : "bg-surface-elevated text-text-primary border border-border"
                }`}
              >
                <span>{list.emoji_icon}</span>
                <span>{list.name}</span>
              </button>
            ))}
            <button
              onClick={() => setSelectedListId("new")}
              className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors ${
                selectedListId === "new"
                  ? "bg-neon-cyan text-white"
                  : "bg-surface-elevated text-text-primary border border-border border-dashed"
              }`}
            >
              <span>+</span>
              <span>New list</span>
            </button>
          </div>
        </div>

        {/* New List Form */}
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
                {EMOJI_OPTIONS.slice(0, 10).map((e) => (
                  <button
                    key={e}
                    onClick={() => setNewListEmoji(e)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${
                      newListEmoji === e
                        ? "bg-neon-cyan/20 ring-1 ring-neon-cyan"
                        : "bg-surface-elevated"
                    }`}
                  >
                    {e}
                  </button>
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
                    className={`w-6 h-6 rounded-full ${
                      newListColor === c ? "ring-2 ring-white ring-offset-1 ring-offset-surface" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div>
        <label className="block text-sm text-text-secondary mb-1.5">
          Status
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setIsVisited(false)}
            className={`flex-1 px-4 py-2 rounded-xl text-sm transition-colors ${
              !isVisited
                ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan"
                : "bg-surface-elevated text-text-secondary border border-border"
            }`}
          >
            Want to try
          </button>
          <button
            onClick={() => setIsVisited(true)}
            className={`flex-1 px-4 py-2 rounded-xl text-sm transition-colors ${
              isVisited
                ? "bg-neon-green/20 text-neon-green border border-neon-green"
                : "bg-surface-elevated text-text-secondary border border-border"
            }`}
          >
            Been here
          </button>
        </div>
      </div>

      {/* Rating */}
      {isVisited && (
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">
            Rating
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(rating === star ? null : star)}
                className={`text-2xl transition-colors ${
                  rating && star <= rating
                    ? "text-neon-orange"
                    : "text-text-muted"
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      )}

        {/* Notes */}
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink resize-none"
          />
        </div>
      </div>

      {/* Actions - fixed at bottom */}
      <div className="flex gap-3 pt-4 border-t border-border mt-2">
        <Button variant="ghost" onClick={onCancel}>
          <BackIcon />
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={selectedListId === "new" ? !newListName.trim() : !selectedListId}
        >
          {selectedListId === "new" ? "Create & Save" : "Save to List"}
        </Button>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-text-muted shrink-0"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="mr-1.5"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
