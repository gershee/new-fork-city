"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { List, Profile } from "@/types";

const ENABLED_LAYERS_KEY = "nyc-fun-enabled-layers";

interface FollowingWithLists extends Profile {
  lists: List[];
}

export default function LayersPage() {
  const router = useRouter();
  const [myLists, setMyLists] = useState<List[]>([]);
  const [followingWithLists, setFollowingWithLists] = useState<FollowingWithLists[]>([]);
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Save enabled layers to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(ENABLED_LAYERS_KEY, JSON.stringify([...enabledLayers]));
    }
  }, [enabledLayers, isLoading]);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Load saved enabled layers from localStorage
      const savedLayers = localStorage.getItem(ENABLED_LAYERS_KEY);
      const savedLayersSet = savedLayers ? new Set<string>(JSON.parse(savedLayers)) : null;

      // Fetch my lists
      const { data: myListsData } = await supabase
        .from("lists")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (myListsData) {
        setMyLists(myListsData);
        // If no saved layers, enable all my lists by default
        if (!savedLayersSet) {
          setEnabledLayers(new Set(myListsData.map((l) => l.id)));
        }
      }

      // Fetch people I follow with their public lists
      const { data: followingData } = await supabase
        .from("follows")
        .select(
          `
          following:profiles!follows_following_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          )
        `
        )
        .eq("follower_id", user.id);

      if (followingData) {
        const followingIds = followingData
          .map((f) => (f.following as unknown as Profile)?.id)
          .filter(Boolean);

        if (followingIds.length > 0) {
          const { data: listsData } = await supabase
            .from("lists")
            .select("*")
            .in("user_id", followingIds)
            .eq("is_public", true)
            .order("name");

          // Group lists by user
          const grouped = followingData.map((f) => {
            const profile = f.following as unknown as Profile;
            return {
              ...profile,
              lists: (listsData || []).filter((l) => l.user_id === profile.id),
            };
          }).filter((f) => f.lists.length > 0);

          setFollowingWithLists(grouped);
        }
      }

      // Apply saved layers if they exist
      if (savedLayersSet) {
        setEnabledLayers(savedLayersSet);
      }

      setIsLoading(false);
    };

    fetchData();
  }, []);

  const toggleLayer = (listId: string) => {
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  };

  const toggleAllForUser = (lists: List[], enable: boolean) => {
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      lists.forEach((l) => {
        if (enable) {
          next.add(l.id);
        } else {
          next.delete(l.id);
        }
      });
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border p-4">
        <h1 className="text-2xl font-bold text-text-primary">Map Layers</h1>
        <p className="text-text-secondary text-sm mt-1">
          Toggle which lists appear on your map
        </p>
      </div>

      {/* My Lists */}
      <div className="p-4">
        <h2 className="text-sm font-medium text-text-secondary mb-3">
          MY LISTS
        </h2>
        {myLists.length === 0 ? (
          <div className="text-center py-8 bg-surface-elevated rounded-xl">
            <p className="text-text-muted">No lists yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myLists.map((list) => (
              <LayerToggle
                key={list.id}
                list={list}
                enabled={enabledLayers.has(list.id)}
                onToggle={() => toggleLayer(list.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Following Lists */}
      {followingWithLists.length > 0 && (
        <div className="p-4 pt-0">
          <h2 className="text-sm font-medium text-text-secondary mb-3">
            FROM PEOPLE YOU FOLLOW
          </h2>
          <div className="space-y-4">
            {followingWithLists.map((following) => (
              <motion.div
                key={following.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface-elevated rounded-xl overflow-hidden"
              >
                {/* User Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface overflow-hidden">
                      {following.avatar_url ? (
                        <img
                          src={following.avatar_url}
                          alt={following.display_name || following.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">
                          👤
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">
                        {following.display_name || following.username}
                      </p>
                      <p className="text-xs text-text-muted">
                        {following.lists.length}{" "}
                        {following.lists.length === 1 ? "list" : "lists"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const allEnabled = following.lists.every((l) =>
                        enabledLayers.has(l.id)
                      );
                      toggleAllForUser(following.lists, !allEnabled);
                    }}
                    className="text-xs text-neon-cyan"
                  >
                    {following.lists.every((l) => enabledLayers.has(l.id))
                      ? "Hide all"
                      : "Show all"}
                  </button>
                </div>

                {/* User's Lists */}
                <div className="p-2">
                  {following.lists.map((list) => (
                    <LayerToggle
                      key={list.id}
                      list={list}
                      enabled={enabledLayers.has(list.id)}
                      onToggle={() => toggleLayer(list.id)}
                      compact
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty Following State */}
      {followingWithLists.length === 0 && (
        <div className="px-4">
          <div className="bg-surface-elevated rounded-xl p-6 text-center">
            <span className="text-3xl mb-3 block">👥</span>
            <h3 className="font-semibold text-text-primary mb-2">
              Follow friends to see their lists
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              When you follow someone, their public lists will appear here as
              layers you can toggle on your map.
            </p>
            <Button variant="primary" onClick={() => router.push("/discover")}>
              Find Friends
            </Button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="px-4 mt-6">
        <div className="bg-neon-purple/10 border border-neon-purple/20 rounded-xl p-4">
          <p className="text-sm text-neon-purple">
            <strong>Tip:</strong> Enabled layers will show their pins on your
            main map view. Different colors help you distinguish whose spots
            are whose!
          </p>
        </div>
      </div>
    </div>
  );
}

function LayerToggle({
  list,
  enabled,
  onToggle,
  compact = false,
}: {
  list: List;
  enabled: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
        compact ? "" : "bg-surface-elevated"
      } ${enabled ? "" : "opacity-50"}`}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${list.color}20` }}
      >
        <span className="text-base">{list.emoji_icon}</span>
      </div>
      <span className="flex-1 text-left text-text-primary font-medium truncate">
        {list.name}
      </span>
      <div
        className={`w-12 h-7 rounded-full p-1 transition-colors ${
          enabled ? "bg-neon-pink" : "bg-surface"
        }`}
      >
        <motion.div
          animate={{ x: enabled ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="w-5 h-5 rounded-full bg-white shadow-md"
        />
      </div>
    </button>
  );
}
