"use client";

import { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { MapView } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { LayersSheet } from "@/components/map/LayersSheet";
import { PinDetail } from "@/components/pins/PinDetail";
import { EditPinForm } from "@/components/pins/EditPinForm";
import { BottomSheet, Button, EmptyState, useToast, getRandomToast } from "@/components/ui";
import { fireConfetti } from "@/components/effects";
import { createClient } from "@/lib/supabase/client";
import type { Pin, List, Profile } from "@/types";

interface SavedByInfo {
  pin: Pin;
  list: List;
  owner: Profile;
}

const ENABLED_LAYERS_KEY = "new-fork-city-enabled-layers";

export default function MapPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MapPage />
    </Suspense>
  );
}

function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data state
  const [pins, setPins] = useState<Pin[]>([]);
  const [allPins, setAllPins] = useState<Pin[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followedUsers, setFollowedUsers] = useState<
    Array<{
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      lists: List[];
    }>
  >([]);

  // UI state
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [editingPin, setEditingPin] = useState<Pin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapMode, setMapMode] = useState<"pins" | "trending">("pins");
  const [showLayersSheet, setShowLayersSheet] = useState(false);
  const [savedByData, setSavedByData] = useState<SavedByInfo[]>([]);
  const [isLoadingSavedBy, setIsLoadingSavedBy] = useState(false);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [isFirstSave, setIsFirstSave] = useState(false);
  const { showToast } = useToast();

  // Calculate list counts for each pin location
  const pinListCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const tolerance = 0.001;

    pins.forEach((pin) => {
      // Find all pins at this location
      const nearby = pins.filter(
        (other) =>
          Math.abs(other.lat - pin.lat) < tolerance &&
          Math.abs(other.lng - pin.lng) < tolerance
      );

      // Count unique lists
      const uniqueLists = new Set(nearby.map((p) => p.list_id));
      counts.set(pin.id, uniqueLists.size);
    });

    return counts;
  }, [pins]);

  // Calculate trending pins (locations with high ratings or on multiple lists)
  const trendingPins = useMemo(() => {
    const tolerance = 0.001;
    const locationMap = new Map<string, Pin[]>();

    // Group pins by location
    pins.forEach((pin) => {
      const latKey = Math.round(pin.lat / tolerance);
      const lngKey = Math.round(pin.lng / tolerance);
      const key = `${latKey},${lngKey}`;

      if (!locationMap.has(key)) {
        locationMap.set(key, []);
      }
      locationMap.get(key)!.push(pin);
    });

    // Filter to trending locations:
    // - Locations with 2+ unique lists (popular)
    // - OR locations with high ratings (4-5 stars) and visited
    const trending: Pin[] = [];
    locationMap.forEach((pinsAtLocation) => {
      const uniqueLists = new Set(pinsAtLocation.map((p) => p.list_id));
      const hasHighRating = pinsAtLocation.some(
        (p) => p.personal_rating && p.personal_rating >= 4 && p.is_visited
      );

      if (uniqueLists.size >= 2 || hasHighRating) {
        // Use the highest rated or most recent pin as representative
        const sorted = [...pinsAtLocation].sort(
          (a, b) =>
            (b.personal_rating || 0) - (a.personal_rating || 0) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        trending.push(sorted[0]);
      }
    });

    console.log("[Trending] Total pins:", pins.length);
    console.log("[Trending] Locations found:", locationMap.size);
    console.log("[Trending] Trending locations:", trending.length);

    return trending;
  }, [pins]);

  // Track hot spots count for discover button badge (using trending pins)
  const hotSpotsCount = useMemo(() => {
    return trendingPins.length;
  }, [trendingPins]);

  // Check URL for trending param
  useEffect(() => {
    if (searchParams.get("trending") === "true") {
      setMapMode("trending");
    }
  }, [searchParams]);

  // Filter pins by enabled layers and ensure they have valid list data
  useEffect(() => {
    // Filter out pins without list data (stray emojis)
    const validPins = allPins.filter((pin) => pin.list && pin.list.emoji_icon);

    console.log("[Filter] All pins:", allPins.length);
    console.log("[Filter] Valid pins after filter:", validPins.length);
    console.log("[Filter] Filtered out:", allPins.length - validPins.length);

    if (enabledLayers.size === 0) {
      setPins(validPins);
    } else {
      const layerFilteredPins = validPins.filter((pin) => enabledLayers.has(pin.list_id));
      console.log("[Filter] After layer filter:", layerFilteredPins.length);
      setPins(layerFilteredPins);
    }
  }, [allPins, enabledLayers]);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = () => {
      const savedLayers = localStorage.getItem(ENABLED_LAYERS_KEY);
      if (savedLayers) {
        setEnabledLayers(new Set(JSON.parse(savedLayers)));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      // Load enabled layers from localStorage
      const savedLayers = localStorage.getItem(ENABLED_LAYERS_KEY);
      if (savedLayers) {
        setEnabledLayers(new Set(JSON.parse(savedLayers)));
      }

      // Fetch user's own lists
      const { data: listsData } = await supabase
        .from("lists")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (listsData) {
        setLists(listsData);
        // Check if this is user's first save (no pins yet)
        setIsFirstSave(listsData.length === 0);
        if (!savedLayers) {
          const defaultEnabled = new Set(listsData.map((l) => l.id));
          setEnabledLayers(defaultEnabled);
          localStorage.setItem(
            ENABLED_LAYERS_KEY,
            JSON.stringify([...defaultEnabled])
          );
        }
      }

      // Fetch user's own pins
      const { data: myPinsData } = await supabase
        .from("pins")
        .select(`*, list:lists(id, name, emoji_icon, color, is_public, user_id)`)
        .eq("user_id", user.id);

      // Fetch people user follows
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      let followedPins: Pin[] = [];

      if (followingData && followingData.length > 0) {
        const followingIds = followingData.map((f) => f.following_id);

        const { data: followedProfilesData } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", followingIds);

        const { data: followedListsData } = await supabase
          .from("lists")
          .select("*")
          .in("user_id", followingIds)
          .eq("is_public", true)
          .order("name");

        if (followedProfilesData && followedListsData) {
          const usersWithLists = followedProfilesData
            .map((profile) => ({
              ...profile,
              lists: followedListsData.filter((l) => l.user_id === profile.id),
            }))
            .filter((u) => u.lists.length > 0);

          setFollowedUsers(usersWithLists);

          const followedListIds = followedListsData.map((l) => l.id);

          if (followedListIds.length > 0) {
            const { data: followedPinsData } = await supabase
              .from("pins")
              .select(
                `
                *,
                list:lists(id, name, emoji_icon, color, is_public, user_id),
                owner:profiles!pins_user_id_fkey(id, username, display_name, avatar_url)
              `
              )
              .in("list_id", followedListIds);

            if (followedPinsData) {
              followedPins = followedPinsData as Pin[];
            }
          }
        }
      }

      const combinedPins = [...(myPinsData || []), ...followedPins] as Pin[];

      // Debug: Log pins without valid list data
      const invalidPins = combinedPins.filter((pin) => !pin.list || !pin.list.emoji_icon);
      if (invalidPins.length > 0) {
        console.log("[DEBUG] Found pins without valid list data:", invalidPins);
      }

      setAllPins(combinedPins);

      setIsLoading(false);
    };

    fetchData();
  }, []);

  // Fetch "saved by" data for a location
  const fetchSavedBy = useCallback(async (pin: Pin) => {
    setIsLoadingSavedBy(true);
    setSavedByData([]);

    const supabase = createClient();
    const tolerance = 0.001; // ~100m - increased for better matching

    const { data: pinsData } = await supabase
      .from("pins")
      .select(`
        *,
        list:lists!list_id(*, profile:profiles!user_id(*))
      `)
      .neq("id", pin.id) // Exclude the current pin
      .gte("lat", pin.lat - tolerance)
      .lte("lat", pin.lat + tolerance)
      .gte("lng", pin.lng - tolerance)
      .lte("lng", pin.lng + tolerance);

    if (pinsData) {
      const savedBy: SavedByInfo[] = pinsData
        .filter((p: any) => p.list) // Only require list data, profile is optional
        .map((p: any) => ({
          pin: p,
          list: p.list,
          owner: p.list.profile || { id: p.user_id, username: "unknown", display_name: null, avatar_url: null },
        }));
      setSavedByData(savedBy);
    }

    setIsLoadingSavedBy(false);
  }, []);

  // Handlers
  const handlePinClick = useCallback((pin: Pin) => {
    setSelectedPin(pin);
    fetchSavedBy(pin);
  }, [fetchSavedBy]);

  const handleCloseSheet = useCallback(() => {
    setSelectedPin(null);
    setEditingPin(null);
    setSavedByData([]);
    setShowSaveSheet(false);
  }, []);

  const handleEditPin = useCallback((pin: Pin) => {
    setSelectedPin(null);
    setEditingPin(pin);
  }, []);

  const handlePinUpdated = useCallback(
    (updatedPin: Pin) => {
      setAllPins((prev) =>
        prev.map((p) => (p.id === updatedPin.id ? updatedPin : p))
      );
      handleCloseSheet();
    },
    [handleCloseSheet]
  );

  const handlePinDeleted = useCallback(
    (pinId: string) => {
      setAllPins((prev) => prev.filter((p) => p.id !== pinId));
      handleCloseSheet();
    },
    [handleCloseSheet]
  );

  const handleModeChange = (mode: "pins" | "trending") => {
    setMapMode(mode);
    if (mode === "trending") {
      window.history.replaceState({}, "", "/explore?trending=true");
    } else {
      window.history.replaceState({}, "", "/explore");
    }
  };

  const handleToggleLayer = (listId: string) => {
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      localStorage.setItem(ENABLED_LAYERS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const handleToggleAllForUser = (listIds: string[], enable: boolean) => {
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      listIds.forEach((id) => {
        if (enable) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      localStorage.setItem(ENABLED_LAYERS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const showTrending = mapMode === "trending";
  const displayPins = showTrending ? trendingPins : pins;

  return (
    <div className="fixed inset-0 pb-16">
      {/* Map */}
      <div className="w-full h-full">
        <MapView
          pins={displayPins}
          onPinClick={handlePinClick}
          showHeatmap={false}
          pinListCounts={pinListCounts}
          showTrending={showTrending}
        />
      </div>

      {/* Map Controls */}
      <MapControls
        mode={mapMode}
        onModeChange={handleModeChange}
        onLayersClick={() => setShowLayersSheet(true)}
        pinCount={pins.length}
        trendingCount={trendingPins.length}
      />

      {/* Floating Search Button */}
      <motion.button
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push("/search")}
        className="fixed top-4 left-4 z-20 bg-surface-elevated/90 backdrop-blur-xl text-text-primary p-3 rounded-full shadow-card border border-border hover:shadow-card-hover"
        aria-label="Search"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </motion.button>

      {/* Floating Profile Button */}
      <motion.button
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push("/profile")}
        className="fixed top-4 right-4 z-20 bg-surface-elevated/90 backdrop-blur-xl text-text-primary p-1 rounded-full shadow-card border border-border hover:shadow-card-hover"
        aria-label="Profile"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold text-sm">
          {currentUserId ? currentUserId.substring(0, 2).toUpperCase() : "?"}
        </div>
      </motion.button>

      {/* Floating Discover Button */}
      {!showTrending && pins.length > 0 && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
          onClick={() => router.push("/trending")}
          className="fixed bottom-24 right-4 z-20 bg-surface-elevated text-text-primary p-3 rounded-2xl shadow-card border border-border hover:shadow-card-hover"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <span className="font-medium text-sm">Trending</span>
          </div>
          {hotSpotsCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-soft-orange rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-background"
            >
              {hotSpotsCount > 9 ? "9+" : hotSpotsCount}
            </motion.div>
          )}
        </motion.button>
      )}

      {/* Empty state overlay */}
      {!showTrending && pins.length === 0 && lists.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-16">
          <div className="bg-surface/90 backdrop-blur-xl rounded-[--radius-lg] p-6 mx-6 pointer-events-auto">
            <EmptyState
              icon="📍"
              title="Start mapping your city"
              description="Search for places to start building your lists"
              action={{
                label: "Search Places",
                onClick: () => router.push("/search"),
              }}
            />
          </div>
        </div>
      )}

      {/* Empty state with lists */}
      {!showTrending && pins.length === 0 && lists.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface/90 backdrop-blur-xl rounded-full px-4 py-2 z-10">
          <p className="text-text-secondary text-sm">
            Search for places to add to your lists
          </p>
        </div>
      )}

      {/* Pin Detail Sheet */}
      <BottomSheet
        isOpen={selectedPin !== null && editingPin === null && !showSaveSheet}
        onClose={handleCloseSheet}
        title={selectedPin?.name}
      >
        {selectedPin && (
          <PinDetail
            pin={selectedPin}
            isOwn={selectedPin.user_id === currentUserId}
            onEdit={() => handleEditPin(selectedPin)}
            savedBy={savedByData}
            isLoadingSavedBy={isLoadingSavedBy}
            onSaveToList={selectedPin.user_id !== currentUserId ? () => setShowSaveSheet(true) : undefined}
          />
        )}
      </BottomSheet>

      {/* Save Pin to My List Sheet */}
      <BottomSheet
        isOpen={showSaveSheet && selectedPin !== null}
        onClose={() => setShowSaveSheet(false)}
        title={`Save "${selectedPin?.name}"`}
      >
        {selectedPin && (
          <SavePinToListForm
            pin={selectedPin}
            lists={lists}
            onSuccess={() => {
              setShowSaveSheet(false);
              handleCloseSheet();
            }}
            onCancel={() => setShowSaveSheet(false)}
            onListCreated={(newList) => {
              setLists((prev) => [newList, ...prev]);
              setIsFirstSave(false); // They now have at least one list
            }}
            onShowToast={showToast}
            isFirstSave={isFirstSave}
          />
        )}
      </BottomSheet>

      {/* Edit Pin Sheet */}
      <BottomSheet
        isOpen={editingPin !== null}
        onClose={handleCloseSheet}
        title="Edit spot"
      >
        {editingPin && (
          <EditPinForm
            pin={editingPin}
            lists={lists}
            onSuccess={handlePinUpdated}
            onDelete={handlePinDeleted}
            onCancel={handleCloseSheet}
          />
        )}
      </BottomSheet>

      {/* Layers Sheet */}
      <BottomSheet
        isOpen={showLayersSheet}
        onClose={() => setShowLayersSheet(false)}
        title="Map Layers"
      >
        <LayersSheet
          myLists={lists}
          followedUsers={followedUsers}
          enabledLayers={enabledLayers}
          onToggleLayer={handleToggleLayer}
          onToggleAllForUser={handleToggleAllForUser}
        />
      </BottomSheet>
    </div>
  );
}

const EMOJI_OPTIONS = [
  "📍", "🍕", "🍔", "🍜", "🍣", "🍷", "🍺", "☕", "🍰", "🌮",
];

const COLOR_OPTIONS = [
  "#ff2d92", "#00f0ff", "#b14eff", "#39ff14",
  "#ff6b35", "#ffd700", "#ff6b6b", "#4ecdc4",
];

// Save Pin to List Form
function SavePinToListForm({
  pin,
  lists,
  onSuccess,
  onCancel,
  onListCreated,
  onShowToast,
  isFirstSave,
}: {
  pin: Pin;
  lists: List[];
  onSuccess: () => void;
  onCancel: () => void;
  onListCreated?: (list: List) => void;
  onShowToast?: (toast: { message: string; emoji?: string; subtext?: string }) => void;
  isFirstSave?: boolean;
}) {
  const [selectedListId, setSelectedListId] = useState(lists[0]?.id || "new");
  const [isVisited, setIsVisited] = useState(false);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListEmoji, setNewListEmoji] = useState("📍");
  const [newListColor, setNewListColor] = useState("#ff2d92");

  const handleSubmit = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsLoading(false); return; }

    let targetListId = selectedListId;
    let createdNewList = false;

    if (selectedListId === "new") {
      if (!newListName.trim()) { setIsLoading(false); return; }
      const { data: newList, error } = await supabase
        .from("lists")
        .insert({ user_id: user.id, name: newListName.trim(), emoji_icon: newListEmoji, color: newListColor, is_public: true })
        .select().single();
      if (error || !newList) { setIsLoading(false); return; }
      onListCreated?.(newList);
      targetListId = newList.id;
      createdNewList = true;
    }

    await supabase.from("pins").insert({
      user_id: user.id, list_id: targetListId, name: pin.name, address: pin.address,
      lat: pin.lat, lng: pin.lng, category: pin.category, is_visited: isVisited, personal_notes: notes || null,
    });

    // Fire celebration effects
    if (isFirstSave) {
      fireConfetti("milestone");
      onShowToast?.(getRandomToast("firstSave"));
    } else if (createdNewList) {
      fireConfetti("list");
      onShowToast?.(getRandomToast("listCreated"));
    } else {
      fireConfetti("save");
      onShowToast?.(getRandomToast("save"));
    }

    setIsLoading(false);
    onSuccess();
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl p-3">
        <p className="font-medium text-text-primary">{pin.name}</p>
        <p className="text-sm text-text-secondary truncate">{pin.address}</p>
      </div>

      <div>
        <label className="block text-sm text-text-secondary mb-1.5">Save to list</label>
        <div className="flex flex-wrap gap-2">
          {lists.map((list) => (
            <button key={list.id} onClick={() => setSelectedListId(list.id)}
              className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors ${selectedListId === list.id ? "bg-neon-pink text-white" : "bg-surface-elevated text-text-primary border border-border"}`}>
              <span>{list.emoji_icon}</span><span>{list.name}</span>
            </button>
          ))}
          <button onClick={() => setSelectedListId("new")}
            className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors ${selectedListId === "new" ? "bg-neon-cyan text-white" : "bg-surface-elevated text-text-primary border border-border border-dashed"}`}>
            <span>+</span><span>New list</span>
          </button>
        </div>
      </div>

      {selectedListId === "new" && (
        <div className="space-y-3 p-3 bg-surface rounded-xl">
          <input type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="List name..."
            className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-cyan" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Icon:</span>
            <div className="flex flex-wrap gap-1">
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} onClick={() => setNewListEmoji(e)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${newListEmoji === e ? "bg-neon-cyan/20 ring-1 ring-neon-cyan" : "bg-surface-elevated"}`}>{e}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Color:</span>
            <div className="flex gap-1">
              {COLOR_OPTIONS.map((c) => (
                <button key={c} onClick={() => setNewListColor(c)}
                  className={`w-6 h-6 rounded-full ${newListColor === c ? "ring-2 ring-white ring-offset-1 ring-offset-surface" : ""}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm text-text-secondary mb-1.5">Status</label>
        <div className="flex gap-2">
          <button onClick={() => setIsVisited(false)}
            className={`flex-1 px-4 py-2 rounded-xl text-sm transition-colors ${!isVisited ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan" : "bg-surface-elevated text-text-secondary border border-border"}`}>Want to try</button>
          <button onClick={() => setIsVisited(true)}
            className={`flex-1 px-4 py-2 rounded-xl text-sm transition-colors ${isVisited ? "bg-neon-green/20 text-neon-green border border-neon-green" : "bg-surface-elevated text-text-secondary border border-border"}`}>Been here</button>
        </div>
      </div>

      <div>
        <label className="block text-sm text-text-secondary mb-1.5">Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note..." rows={2}
          className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink resize-none" />
      </div>

      <div className="flex gap-3 pt-2 sticky bottom-0 bg-surface pb-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" className="flex-1" onClick={handleSubmit} isLoading={isLoading}
          disabled={selectedListId === "new" ? !newListName.trim() : !selectedListId}>
          {selectedListId === "new" ? "Create & Save" : "Save"}
        </Button>
      </div>
    </div>
  );
}
