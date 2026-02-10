"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Header, Card, Avatar, Badge, EmptyState } from "@/components/ui";
import type { Profile, List, Pin } from "@/types";

// Types
interface ActivityItem {
  id: string;
  type: "pin_added" | "list_created";
  user: Profile;
  pin?: Pin & { list: List };
  list?: List;
  created_at: string;
}


export default function FeedPage() {
  const router = useRouter();

  // Following state
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);

  // Fetch activity feed
  useEffect(() => {
    const fetchActivity = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      if (!following || following.length === 0) {
        setIsLoadingActivity(false);
        return;
      }

      const followingIds = following.map((f) => f.following_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", followingIds);

      const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const { data: recentPins } = await supabase
        .from("pins")
        .select(`*, list:lists(*)`)
        .in("user_id", followingIds)
        .order("created_at", { ascending: false })
        .limit(30);

      const { data: recentLists } = await supabase
        .from("lists")
        .select("*")
        .in("user_id", followingIds)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(20);

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

      activityItems.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setActivities(activityItems.slice(0, 50));
      setIsLoadingActivity(false);
    };

    fetchActivity();
  }, [router]);


  return (
    <div className="min-h-screen bg-background pb-20">
      <Header
        title="Feed"
        rightAction={
          <button
            onClick={() => router.push("/trending")}
            className="flex items-center gap-2 px-3 py-2 rounded-[--radius-md] bg-surface-elevated hover:bg-surface-hover transition-colors"
          >
            <span className="text-sm font-medium">🔥 Trending</span>
          </button>
        }
      />

      {/* Following Feed Only */}
      <FollowingFeed
        activities={activities}
        isLoading={isLoadingActivity}
        onUserClick={(username) => router.push(`/user/${username}`)}
        onPinClick={(listId) => router.push(`/lists/${listId}`)}
        onListClick={(listId) => router.push(`/lists/${listId}`)}
        onFindPeople={() => router.push("/discover")}
      />
    </div>
  );
}

// Group activities by user
interface UserWithActivity {
  user: Profile;
  activities: ActivityItem[];
  latestActivity: string;
}

// Following Feed Component - User-centric view
function FollowingFeed({
  activities,
  isLoading,
  onUserClick,
  onPinClick,
  onListClick,
  onFindPeople,
}: {
  activities: ActivityItem[];
  isLoading: boolean;
  onUserClick: (username: string) => void;
  onPinClick: (listId: string) => void;
  onListClick: (listId: string) => void;
  onFindPeople: () => void;
}) {
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon="👀"
          title="No activity yet"
          description="Follow people to see their activity here"
          action={{
            label: "Find People",
            onClick: onFindPeople,
          }}
        />
      </div>
    );
  }

  // Group activities by user
  const userActivityMap = new Map<string, UserWithActivity>();
  activities.forEach((activity) => {
    const userId = activity.user.id;
    if (!userActivityMap.has(userId)) {
      userActivityMap.set(userId, {
        user: activity.user,
        activities: [],
        latestActivity: activity.created_at,
      });
    }
    userActivityMap.get(userId)!.activities.push(activity);
  });

  const usersWithActivity = Array.from(userActivityMap.values()).sort(
    (a, b) => new Date(b.latestActivity).getTime() - new Date(a.latestActivity).getTime()
  );

  const toggleUser = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  return (
    <div className="p-4 space-y-2">
      {usersWithActivity.map((userActivity, index) => (
        <motion.div
          key={userActivity.user.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
        >
          <UserActivityRow
            userActivity={userActivity}
            isExpanded={expandedUsers.has(userActivity.user.id)}
            onToggle={() => toggleUser(userActivity.user.id)}
            onUserClick={() => onUserClick(userActivity.user.username)}
            onPinClick={onPinClick}
            onListClick={onListClick}
          />
        </motion.div>
      ))}
    </div>
  );
}

// User Activity Row - expandable
function UserActivityRow({
  userActivity,
  isExpanded,
  onToggle,
  onUserClick,
  onPinClick,
  onListClick,
}: {
  userActivity: UserWithActivity;
  isExpanded: boolean;
  onToggle: () => void;
  onUserClick: () => void;
  onPinClick: (listId: string) => void;
  onListClick: (listId: string) => void;
}) {
  const { user, activities, latestActivity } = userActivity;
  const activityCount = activities.length;
  const pinCount = activities.filter((a) => a.type === "pin_added").length;
  const listCount = activities.filter((a) => a.type === "list_created").length;

  // Summary text with user name and action
  const userName = user.display_name || user.username;
  let summary = "";
  if (pinCount > 0 && listCount > 0) {
    summary = `${userName} added ${pinCount} spot${pinCount > 1 ? "s" : ""}, created ${listCount} list${listCount > 1 ? "s" : ""}`;
  } else if (pinCount > 0) {
    summary = `${userName} added ${pinCount} spot${pinCount > 1 ? "s" : ""}`;
  } else {
    summary = `${userName} created ${listCount} list${listCount > 1 ? "s" : ""}`;
  }

  return (
    <div className="bg-surface-elevated rounded-[--radius-lg] overflow-hidden">
      {/* User Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-surface-hover transition-colors text-left"
      >
        <Avatar
          src={user.avatar_url}
          alt={user.display_name || user.username}
          fallback={(user.display_name || user.username)?.[0]}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text-primary truncate">
            {user.display_name || user.username}
          </p>
          <p className="text-sm text-text-muted">
            {summary} • {formatDistanceToNow(new Date(latestActivity), { addSuffix: true })}
          </p>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronIcon />
        </motion.div>
      </button>

      {/* Expanded Activity */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1">
              {activities.map((activity) => (
                <div key={activity.id}>
                  {activity.type === "pin_added" && activity.pin && (
                    <button
                      onClick={() => onPinClick(activity.pin!.list.id)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-[--radius-sm] hover:bg-surface-hover transition-colors text-left"
                    >
                      <span className="text-base shrink-0">{activity.pin.list.emoji_icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {activity.pin.name}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                          {activity.pin.list.name}
                        </p>
                      </div>
                      <span className="text-xs text-text-muted shrink-0">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </span>
                    </button>
                  )}
                  {activity.type === "list_created" && activity.list && (
                    <button
                      onClick={() => onListClick(activity.list!.id)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-[--radius-sm] hover:bg-surface-hover transition-colors text-left"
                    >
                      <span className="text-base shrink-0">{activity.list.emoji_icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {activity.list.name}
                        </p>
                        <p className="text-xs text-text-muted">New list</p>
                      </div>
                      <span className="text-xs text-text-muted shrink-0">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </span>
                    </button>
                  )}
                </div>
              ))}
              {/* View Profile link */}
              <button
                onClick={onUserClick}
                className="w-full text-center py-2 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                View @{user.username}&apos;s profile
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// Trending Feed Component
function TrendingFeed({
  subTab,
  spots,
  lists,
  users,
  isLoading,
  onSpotClick,
  onListClick,
  onUserClick,
}: {
  subTab: TrendingSubTab;
  spots: TrendingSpot[];
  lists: TrendingList[];
  users: TrendingUser[];
  isLoading: boolean;
  onSpotClick: (listId: string) => void;
  onListClick: (listId: string) => void;
  onUserClick: (username: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <AnimatePresence mode="wait">
        {subTab === "spots" && (
          <motion.div
            key="spots"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {spots.length === 0 ? (
              <EmptyState
                icon="📍"
                title="No hot spots yet"
                description="Spots will appear as users rate them"
              />
            ) : (
              spots.map((spot, index) => (
                <TrendingSpotCard
                  key={spot.id}
                  spot={spot}
                  rank={index + 1}
                  onClick={() => onSpotClick(spot.list_id)}
                />
              ))
            )}
          </motion.div>
        )}

        {subTab === "lists" && (
          <motion.div
            key="lists"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {lists.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No trending lists"
                description="Lists will appear as users create them"
              />
            ) : (
              lists.map((list, index) => (
                <TrendingListCard
                  key={list.id}
                  list={list}
                  rank={index + 1}
                  onClick={() => onListClick(list.id)}
                  onUserClick={() => list.profile?.username && onUserClick(list.profile.username)}
                />
              ))
            )}
          </motion.div>
        )}

        {subTab === "users" && (
          <motion.div
            key="users"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {users.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No rising users"
                description="Users will appear as they gain followers"
              />
            ) : (
              users.map((user, index) => (
                <TrendingUserCard
                  key={user.id}
                  user={user}
                  rank={index + 1}
                  onClick={() => onUserClick(user.username)}
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Trending Spot Card
function TrendingSpotCard({
  spot,
  rank,
  onClick,
}: {
  spot: TrendingSpot;
  rank: number;
  onClick: () => void;
}) {
  return (
    <Card variant="interactive" padding="md" onClick={onClick}>
      <div className="flex items-start gap-3">
        <RankBadge rank={rank} />
        <div
          className="w-10 h-10 rounded-[--radius-sm] flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${spot.list?.color || "#f04e8c"}20` }}
        >
          <span className="text-lg">{spot.list?.emoji_icon || "📍"}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text-primary truncate">{spot.name}</p>
          <p className="text-sm text-text-muted truncate">{spot.address}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {spot.personal_rating && (
              <Badge variant="rating" size="sm">
                {"★".repeat(spot.personal_rating)}
              </Badge>
            )}
            {spot.save_count > 1 && (
              <span className="text-xs text-primary font-medium">
                {spot.save_count} saves
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Trending List Card
function TrendingListCard({
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
  return (
    <Card variant="elevated" padding="md">
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start gap-3">
          <RankBadge rank={rank} />
          <div
            className="w-10 h-10 rounded-[--radius-sm] flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${list.color}20` }}
          >
            <span className="text-lg">{list.emoji_icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text-primary truncate">{list.name}</p>
            {list.description && (
              <p className="text-sm text-text-muted truncate">{list.description}</p>
            )}
            <Badge variant="default" size="sm" className="mt-1.5">
              {list.pins_count} {list.pins_count === 1 ? "spot" : "spots"}
            </Badge>
          </div>
        </div>
      </button>
      {list.profile && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUserClick();
          }}
          className="flex items-center gap-2 mt-3 pt-3 border-t border-border w-full hover:opacity-80 transition-opacity"
        >
          <Avatar
            src={list.profile.avatar_url}
            alt={list.profile.display_name || list.profile.username}
            fallback={(list.profile.display_name || list.profile.username)?.[0]}
            size="xs"
          />
          <span className="text-sm text-text-secondary">
            {list.profile.display_name || list.profile.username}
          </span>
        </button>
      )}
    </Card>
  );
}

// Trending User Card
function TrendingUserCard({
  user,
  rank,
  onClick,
}: {
  user: TrendingUser;
  rank: number;
  onClick: () => void;
}) {
  return (
    <Card variant="interactive" padding="md" onClick={onClick}>
      <div className="flex items-center gap-3">
        <RankBadge rank={rank} />
        <Avatar
          src={user.avatar_url}
          alt={user.display_name || user.username}
          fallback={(user.display_name || user.username)?.[0]}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary truncate">
            {user.display_name || user.username}
          </p>
          <p className="text-sm text-text-muted truncate">@{user.username}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">{user.followers_count}</span> followers
            </span>
            <span className="text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">{user.lists_count}</span> lists
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Rank Badge
function RankBadge({ rank }: { rank: number }) {
  const getStyle = () => {
    if (rank === 1) return "bg-yellow-500 text-white";
    if (rank === 2) return "bg-gray-400 text-white";
    if (rank === 3) return "bg-amber-600 text-white";
    return "bg-surface text-text-muted";
  };

  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getStyle()}`}>
      {rank}
    </div>
  );
}

// Search Icon
function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

