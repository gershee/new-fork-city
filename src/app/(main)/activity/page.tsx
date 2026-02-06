"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Profile, List, Pin } from "@/types";

interface ActivityItem {
  id: string;
  type: "pin_added" | "list_created";
  user: Profile;
  pin?: Pin & { list: List };
  list?: List;
  created_at: string;
}

export default function ActivityPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      // Get users the current user is following
      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      if (!following || following.length === 0) {
        setIsLoading(false);
        return;
      }

      const followingIds = following.map((f) => f.following_id);

      // Fetch profiles of followed users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", followingIds);

      const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Fetch recent pins from followed users (with their lists)
      const { data: recentPins } = await supabase
        .from("pins")
        .select(`
          *,
          list:lists(*)
        `)
        .in("user_id", followingIds)
        .order("created_at", { ascending: false })
        .limit(30);

      // Fetch recent lists from followed users
      const { data: recentLists } = await supabase
        .from("lists")
        .select("*")
        .in("user_id", followingIds)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(20);

      // Combine into activity items
      const activityItems: ActivityItem[] = [];

      recentPins?.forEach((pin) => {
        const user = profilesMap.get(pin.user_id);
        if (user && pin.list?.is_public) {
          activityItems.push({
            id: `pin-${pin.id}`,
            type: "pin_added",
            user,
            pin: { ...pin, list: pin.list },
            created_at: pin.created_at,
          });
        }
      });

      recentLists?.forEach((list) => {
        const user = profilesMap.get(list.user_id);
        if (user) {
          activityItems.push({
            id: `list-${list.id}`,
            type: "list_created",
            user,
            list,
            created_at: list.created_at,
          });
        }
      });

      // Sort by date
      activityItems.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setActivities(activityItems.slice(0, 50));
      setIsLoading(false);
    };

    fetchActivity();
  }, [router]);

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
        <h1 className="text-2xl font-bold text-text-primary">Activity</h1>
        <p className="text-sm text-text-muted mt-1">See what your friends are saving</p>
      </div>

      {/* Activity Feed */}
      <div className="p-4">
        {activities.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-surface-elevated flex items-center justify-center">
              <span className="text-4xl">👀</span>
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              No activity yet
            </h2>
            <p className="text-text-secondary mb-6">
              Follow people to see their activity here
            </p>
            <button
              onClick={() => router.push("/discover")}
              className="px-6 py-3 bg-neon-pink text-white rounded-xl font-medium hover:bg-neon-pink/90 transition-colors"
            >
              Find People to Follow
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {activities.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  {activity.type === "pin_added" && activity.pin && (
                    <PinActivityCard
                      activity={activity}
                      onUserClick={() =>
                        router.push(`/user/${activity.user.username}`)
                      }
                      onPinClick={() =>
                        router.push(`/lists/${activity.pin?.list.id}`)
                      }
                    />
                  )}
                  {activity.type === "list_created" && activity.list && (
                    <ListActivityCard
                      activity={activity}
                      onUserClick={() =>
                        router.push(`/user/${activity.user.username}`)
                      }
                      onListClick={() =>
                        router.push(`/lists/${activity.list?.id}`)
                      }
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function PinActivityCard({
  activity,
  onUserClick,
  onPinClick,
}: {
  activity: ActivityItem;
  onUserClick: () => void;
  onPinClick: () => void;
}) {
  const { user, pin, created_at } = activity;
  if (!pin) return null;

  return (
    <div className="bg-surface-elevated rounded-2xl p-4">
      {/* User header */}
      <div className="flex items-center gap-3 mb-3">
        <button onClick={onUserClick} className="shrink-0">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.display_name || user.username}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-pink to-neon-purple flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {(user.display_name || user.username)?.[0]?.toUpperCase()}
              </span>
            </div>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <button
              onClick={onUserClick}
              className="font-semibold text-text-primary hover:text-neon-pink transition-colors"
            >
              {user.display_name || user.username}
            </button>
            <span className="text-text-muted"> saved a spot</span>
          </p>
          <p className="text-xs text-text-muted">
            {formatDistanceToNow(new Date(created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Pin content */}
      <button
        onClick={onPinClick}
        className="w-full bg-surface rounded-xl p-3 text-left hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${pin.list.color}20` }}
          >
            <span className="text-xl">{pin.list.emoji_icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text-primary truncate">{pin.name}</p>
            <p className="text-sm text-text-muted truncate">{pin.address}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${pin.list.color}20`,
                  color: pin.list.color,
                }}
              >
                {pin.list.name}
              </span>
              {pin.is_visited && (
                <span className="text-xs text-neon-green">✓ Visited</span>
              )}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function ListActivityCard({
  activity,
  onUserClick,
  onListClick,
}: {
  activity: ActivityItem;
  onUserClick: () => void;
  onListClick: () => void;
}) {
  const { user, list, created_at } = activity;
  if (!list) return null;

  return (
    <div className="bg-surface-elevated rounded-2xl p-4">
      {/* User header */}
      <div className="flex items-center gap-3 mb-3">
        <button onClick={onUserClick} className="shrink-0">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.display_name || user.username}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-pink to-neon-purple flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {(user.display_name || user.username)?.[0]?.toUpperCase()}
              </span>
            </div>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <button
              onClick={onUserClick}
              className="font-semibold text-text-primary hover:text-neon-pink transition-colors"
            >
              {user.display_name || user.username}
            </button>
            <span className="text-text-muted"> created a new list</span>
          </p>
          <p className="text-xs text-text-muted">
            {formatDistanceToNow(new Date(created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* List content */}
      <button
        onClick={onListClick}
        className="w-full bg-surface rounded-xl p-3 text-left hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${list.color}20` }}
          >
            <span className="text-xl">{list.emoji_icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text-primary truncate">{list.name}</p>
            {list.description && (
              <p className="text-sm text-text-muted truncate">{list.description}</p>
            )}
          </div>
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: list.color }}
          />
        </div>
      </button>
    </div>
  );
}
