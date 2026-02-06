"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Pin, List, Profile } from "@/types";

interface TrendingSpot extends Pin {
  save_count: number;
  list: List & { profile: Profile };
}

interface TrendingList extends List {
  pins_count: number;
  profile: Profile;
}

interface TrendingUser extends Profile {
  followers_count: number;
  lists_count: number;
}

type Tab = "spots" | "lists" | "users";

export default function TrendingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("spots");
  const [spots, setSpots] = useState<TrendingSpot[]>([]);
  const [lists, setLists] = useState<TrendingList[]>([]);
  const [users, setUsers] = useState<TrendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      const supabase = createClient();

      // Fetch trending spots (pins that appear in multiple lists or highly rated)
      const { data: pinsData } = await supabase
        .from("pins")
        .select(`
          *,
          list:lists!inner(
            *,
            profile:profiles(id, username, display_name, avatar_url)
          )
        `)
        .eq("list.is_public", true)
        .eq("is_visited", true)
        .gte("personal_rating", 4)
        .order("created_at", { ascending: false })
        .limit(20);

      if (pinsData) {
        // Group by location (approximate) and count
        const spotMap = new Map<string, TrendingSpot>();
        pinsData.forEach((pin: any) => {
          const key = `${pin.lat.toFixed(4)},${pin.lng.toFixed(4)}`;
          if (!spotMap.has(key)) {
            spotMap.set(key, { ...pin, save_count: 1 });
          } else {
            const existing = spotMap.get(key)!;
            existing.save_count++;
            // Keep the one with higher rating
            if ((pin.personal_rating || 0) > (existing.personal_rating || 0)) {
              spotMap.set(key, { ...pin, save_count: existing.save_count });
            }
          }
        });

        const sortedSpots = Array.from(spotMap.values())
          .sort((a, b) => b.save_count - a.save_count || (b.personal_rating || 0) - (a.personal_rating || 0));
        setSpots(sortedSpots);
      }

      // Fetch trending lists (public lists with most pins)
      const { data: listsData } = await supabase
        .from("lists")
        .select(`
          *,
          profile:profiles(id, username, display_name, avatar_url),
          pins:pins(count)
        `)
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (listsData) {
        const listsWithCount = listsData
          .map((list: any) => ({
            ...list,
            pins_count: list.pins?.[0]?.count || 0,
          }))
          .filter((list: any) => list.pins_count > 0)
          .sort((a: any, b: any) => b.pins_count - a.pins_count);
        setLists(listsWithCount);
      }

      // Fetch trending users (users with most followers)
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .limit(50);

      if (profilesData) {
        // Get follower counts for each user
        const usersWithStats = await Promise.all(
          profilesData.map(async (profile) => {
            const [followersResult, listsResult] = await Promise.all([
              supabase
                .from("follows")
                .select("*", { count: "exact", head: true })
                .eq("following_id", profile.id),
              supabase
                .from("lists")
                .select("*", { count: "exact", head: true })
                .eq("user_id", profile.id)
                .eq("is_public", true),
            ]);

            return {
              ...profile,
              followers_count: followersResult.count || 0,
              lists_count: listsResult.count || 0,
            };
          })
        );

        const sortedUsers = usersWithStats
          .filter((u) => u.lists_count > 0)
          .sort((a, b) => b.followers_count - a.followers_count);
        setUsers(sortedUsers);
      }

      setIsLoading(false);
    };

    fetchTrending();
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "spots", label: "Hot Spots", icon: "🔥" },
    { id: "lists", label: "Top Lists", icon: "📋" },
    { id: "users", label: "Rising", icon: "⭐" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-3xl">📈</span> Trending
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Discover what's hot in NYC right now
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
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

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="p-4">
          <AnimatePresence mode="wait">
            {activeTab === "spots" && (
              <motion.div
                key="spots"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {spots.length === 0 ? (
                  <EmptyState
                    icon="🔥"
                    title="No hot spots yet"
                    description="Spots will appear here as users rate them"
                  />
                ) : (
                  spots.map((spot, index) => (
                    <SpotCard
                      key={spot.id}
                      spot={spot}
                      rank={index + 1}
                      onClick={() => router.push(`/lists/${spot.list_id}`)}
                    />
                  ))
                )}
              </motion.div>
            )}

            {activeTab === "lists" && (
              <motion.div
                key="lists"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {lists.length === 0 ? (
                  <EmptyState
                    icon="📋"
                    title="No trending lists"
                    description="Lists will appear here as users create them"
                  />
                ) : (
                  lists.map((list, index) => (
                    <ListCard
                      key={list.id}
                      list={list}
                      rank={index + 1}
                      onClick={() => router.push(`/lists/${list.id}`)}
                      onUserClick={() => router.push(`/user/${list.profile.username}`)}
                    />
                  ))
                )}
              </motion.div>
            )}

            {activeTab === "users" && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {users.length === 0 ? (
                  <EmptyState
                    icon="⭐"
                    title="No rising users"
                    description="Users will appear here as they gain followers"
                  />
                ) : (
                  users.map((user, index) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      rank={index + 1}
                      onClick={() => router.push(`/user/${user.username}`)}
                    />
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Heatmap CTA */}
      <div className="fixed bottom-20 left-4 right-4 z-10">
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => router.push("/explore?heatmap=true")}
          className="w-full bg-gradient-to-r from-neon-orange via-neon-pink to-neon-purple p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-neon-pink/20"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🗺️</span>
            <div className="text-left">
              <p className="font-semibold text-white">View Heatmap</p>
              <p className="text-white/70 text-sm">See where everyone's going</p>
            </div>
          </div>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}

function SpotCard({
  spot,
  rank,
  onClick,
}: {
  spot: TrendingSpot;
  rank: number;
  onClick: () => void;
}) {
  const getRankStyle = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-br from-yellow-400 to-orange-500 text-white";
    if (rank === 2) return "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800";
    if (rank === 3) return "bg-gradient-to-br from-amber-600 to-amber-700 text-white";
    return "bg-surface text-text-muted";
  };

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full bg-surface-elevated rounded-2xl p-4 text-left relative overflow-hidden"
    >
      {/* Rank badge */}
      <div
        className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getRankStyle(rank)}`}
      >
        {rank}
      </div>

      {/* Glow effect for top 3 */}
      {rank <= 3 && (
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(circle at top right, ${spot.list?.color || "#ff2d92"}, transparent 70%)`,
          }}
        />
      )}

      <div className="flex items-start gap-3 pr-10">
        {/* Emoji */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{ backgroundColor: `${spot.list?.color || "#ff2d92"}20` }}
        >
          {spot.list?.emoji_icon || "📍"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary truncate">{spot.name}</h3>
          <p className="text-sm text-text-secondary truncate">{spot.address}</p>

          <div className="flex items-center gap-3 mt-2">
            {/* Rating */}
            {spot.personal_rating && (
              <span className="text-neon-orange text-sm">
                {"★".repeat(spot.personal_rating)}
              </span>
            )}

            {/* Save count */}
            {spot.save_count > 1 && (
              <span className="text-xs text-neon-pink font-medium">
                🔥 {spot.save_count} saves
              </span>
            )}
          </div>

          {/* Creator */}
          <div className="flex items-center gap-2 mt-2">
            <div className="w-5 h-5 rounded-full bg-surface overflow-hidden">
              {spot.list?.profile?.avatar_url ? (
                <img
                  src={spot.list.profile.avatar_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs">👤</div>
              )}
            </div>
            <span className="text-xs text-text-muted">
              @{spot.list?.profile?.username}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function ListCard({
  list,
  rank,
  onClick,
  onUserClick,
}: {
  list: TrendingList;
  rank: number;
  onClick: () => void;
  onUserClick: () => void;
}) {
  const getRankStyle = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-br from-yellow-400 to-orange-500 text-white";
    if (rank === 2) return "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800";
    if (rank === 3) return "bg-gradient-to-br from-amber-600 to-amber-700 text-white";
    return "bg-surface text-text-muted";
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="bg-surface-elevated rounded-2xl p-4 relative overflow-hidden"
    >
      {/* Rank badge */}
      <div
        className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getRankStyle(rank)}`}
      >
        {rank}
      </div>

      {/* Color accent */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: list.color }}
      />

      {/* Glow effect for top 3 */}
      {rank <= 3 && (
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(circle at top right, ${list.color}, transparent 70%)`,
          }}
        />
      )}

      <button onClick={onClick} className="w-full text-left pr-10">
        <div className="flex items-start gap-3">
          {/* Emoji */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: `${list.color}20` }}
          >
            {list.emoji_icon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary truncate">{list.name}</h3>
            {list.description && (
              <p className="text-sm text-text-secondary truncate">{list.description}</p>
            )}

            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-surface px-2 py-1 rounded-full text-text-muted">
                {list.pins_count} {list.pins_count === 1 ? "spot" : "spots"}
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Creator */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onUserClick();
        }}
        className="flex items-center gap-2 mt-3 pt-3 border-t border-border w-full hover:opacity-80 transition-opacity"
      >
        <div className="w-6 h-6 rounded-full bg-surface overflow-hidden">
          {list.profile?.avatar_url ? (
            <img
              src={list.profile.avatar_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs">👤</div>
          )}
        </div>
        <span className="text-sm text-text-secondary">
          {list.profile?.display_name || list.profile?.username}
        </span>
        <span className="text-xs text-text-muted">@{list.profile?.username}</span>
      </button>
    </motion.div>
  );
}

function UserCard({
  user,
  rank,
  onClick,
}: {
  user: TrendingUser;
  rank: number;
  onClick: () => void;
}) {
  const getRankStyle = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-br from-yellow-400 to-orange-500 text-white";
    if (rank === 2) return "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800";
    if (rank === 3) return "bg-gradient-to-br from-amber-600 to-amber-700 text-white";
    return "bg-surface text-text-muted";
  };

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full bg-surface-elevated rounded-2xl p-4 text-left relative overflow-hidden"
    >
      {/* Rank badge */}
      <div
        className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getRankStyle(rank)}`}
      >
        {rank}
      </div>

      {/* Glow effect for top 3 */}
      {rank <= 3 && (
        <div
          className="absolute inset-0 opacity-5"
          style={{
            background: "radial-gradient(circle at top right, #ff2d92, transparent 70%)",
          }}
        />
      )}

      <div className="flex items-center gap-4 pr-10">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-surface overflow-hidden shrink-0 ring-2 ring-neon-pink/20">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.display_name || user.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary truncate">
            {user.display_name || user.username}
          </h3>
          <p className="text-sm text-text-muted truncate">@{user.username}</p>

          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">{user.followers_count}</span> followers
            </span>
            <span className="text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">{user.lists_count}</span> lists
            </span>
          </div>
        </div>
      </div>

      {user.bio && (
        <p className="text-sm text-text-secondary mt-3 line-clamp-2">{user.bio}</p>
      )}
    </motion.button>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-16">
      <span className="text-5xl mb-4 block">{icon}</span>
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-text-secondary">{description}</p>
    </div>
  );
}
