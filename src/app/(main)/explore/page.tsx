"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { MapView } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { HeatmapLegend } from "@/components/map/HeatmapLegend";
import { LayersSheet } from "@/components/map/LayersSheet";
import { PinDetail } from "@/components/pins/PinDetail";
import { AddPinSheet } from "@/components/pins/AddPinSheet";
import { EditPinForm } from "@/components/pins/EditPinForm";
import { BottomSheet, Button, EmptyState } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Pin, List } from "@/types";

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
  const [heatmapPins, setHeatmapPins] = useState<Pin[]>([]);
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
  const [newPinLocation, setNewPinLocation] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapMode, setMapMode] = useState<"pins" | "heatmap">("pins");
  const [showLayersSheet, setShowLayersSheet] = useState(false);

  // Check URL for heatmap param
  useEffect(() => {
    if (searchParams.get("heatmap") === "true") {
      setMapMode("heatmap");
    }
  }, [searchParams]);

  // Filter pins by enabled layers
  useEffect(() => {
    if (enabledLayers.size === 0) {
      setPins(allPins);
    } else {
      setPins(allPins.filter((pin) => enabledLayers.has(pin.list_id)));
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
      setAllPins(combinedPins);

      // Fetch ALL public pins for heatmap
      const { data: allPublicPins } = await supabase
        .from("pins")
        .select(`*, list:lists!inner(id, name, emoji_icon, color, is_public)`)
        .eq("list.is_public", true);

      if (allPublicPins) {
        setHeatmapPins(allPublicPins as Pin[]);
      }

      setIsLoading(false);
    };

    fetchData();
  }, []);

  // Handlers
  const handlePinClick = useCallback((pin: Pin) => {
    setSelectedPin(pin);
  }, []);

  const handleMapClick = useCallback(
    (lngLat: { lng: number; lat: number }) => {
      if (lists.length > 0) {
        setNewPinLocation(lngLat);
      }
    },
    [lists]
  );

  const handleCloseSheet = useCallback(() => {
    setSelectedPin(null);
    setNewPinLocation(null);
    setEditingPin(null);
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

  const handleModeChange = (mode: "pins" | "heatmap") => {
    setMapMode(mode);
    if (mode === "heatmap") {
      window.history.replaceState({}, "", "/explore?heatmap=true");
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

  const showHeatmap = mapMode === "heatmap";

  return (
    <div className="fixed inset-0 pb-16">
      {/* Map */}
      <div className="w-full h-full">
        <MapView
          pins={showHeatmap ? heatmapPins : pins}
          onPinClick={showHeatmap ? undefined : handlePinClick}
          onMapClick={showHeatmap ? undefined : handleMapClick}
          showHeatmap={showHeatmap}
        />
      </div>

      {/* Map Controls */}
      <MapControls
        mode={mapMode}
        onModeChange={handleModeChange}
        onLayersClick={() => setShowLayersSheet(true)}
        pinCount={pins.length}
      />

      {/* Heatmap Legend */}
      <AnimatePresence>
        {showHeatmap && <HeatmapLegend pinCount={heatmapPins.length} />}
      </AnimatePresence>

      {/* Empty state overlay */}
      {!showHeatmap && pins.length === 0 && lists.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-16">
          <div className="bg-surface/90 backdrop-blur-xl rounded-[--radius-lg] p-6 mx-6 pointer-events-auto">
            <EmptyState
              icon="📍"
              title="Start mapping your city"
              description="Create your first list to start saving places"
              action={{
                label: "Create a List",
                onClick: () => router.push("/lists"),
              }}
            />
          </div>
        </div>
      )}

      {/* Tap to add hint */}
      {!showHeatmap && pins.length === 0 && lists.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface/90 backdrop-blur-xl rounded-full px-4 py-2 z-10">
          <p className="text-text-secondary text-sm">
            Tap anywhere to add a pin
          </p>
        </div>
      )}

      {/* Pin Detail Sheet */}
      <BottomSheet
        isOpen={selectedPin !== null && editingPin === null}
        onClose={handleCloseSheet}
        title={selectedPin?.name}
      >
        {selectedPin && (
          <PinDetail
            pin={selectedPin}
            isOwn={selectedPin.user_id === currentUserId}
            onEdit={() => handleEditPin(selectedPin)}
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

      {/* Add Pin Sheet */}
      <BottomSheet
        isOpen={newPinLocation !== null}
        onClose={handleCloseSheet}
        title="Add a new spot"
      >
        {newPinLocation && (
          <AddPinSheet
            location={newPinLocation}
            lists={lists}
            onSuccess={(pin) => {
              setAllPins((prev) => [...prev, pin]);
              handleCloseSheet();
            }}
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
