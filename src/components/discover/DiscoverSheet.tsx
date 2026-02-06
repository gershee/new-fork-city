"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Avatar, Input, Tabs, EmptyState } from "@/components/ui";
import { ListCard } from "@/components/lists/ListCard";
import { createClient } from "@/lib/supabase/client";
import type { Profile, List } from "@/types";

interface UserWithStats extends Profile {
  lists_count: number;
  followers_count: number;
  is_following: boolean;
}

interface ListWithOwner extends List {
  pins_count: number;
  owner: Profile;
}

type SearchTab = "users" | "lists";

interface DiscoverSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DiscoverSheet({ isOpen, onClose }: DiscoverSheetProps) {
  const router = useRouter();
  const [tab, setTab] = useState<SearchTab>("users");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [lists, setLists] = useState<ListWithOwner[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserWithStats[]>([]);
  const [trendingLists, setTrendingLists] = useState<ListWithOwner[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when sheet opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setUsers([]);
      setLists([]);
    }
  }, [isOpen]);

  // Load initial data
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;
      setCurrentUserId(user.id);

      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = following?.map((f) => f.following_id) || [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", user.id)
        .limit(15);

      if (profiles) {
        const usersWithStats = await Promise.all(
          profiles.map(async (profile) => {
            const [listsResult, followersResult] = await Promise.all([
              supabase.from("lists").select("*", { count: "exact", head: true }).eq("user_id", profile.id).eq("is_public", true),
              supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
            ]);

            return {
              ...profile,
              lists_count: listsResult.count || 0,
              followers_count: followersResult.count || 0,
              is_following: followingIds.includes(profile.id),
            };
          })
        );

        const sorted = usersWithStats
          .filter((u) => u.lists_count > 0)
          .sort((a, b) => b.followers_count - a.followers_count);

        setSuggestedUsers(sorted);
      }

      const { data: listsData } = await supabase
        .from("lists")
        .select(`*, pins:pins(count)`)
        .eq("is_public", true)
        .neq("user_id", user.id)
        .limit(15);

      if (listsData && listsData.length > 0) {
        const ownerIds = [...new Set(listsData.map((l) => l.user_id))];
        const { data: ownersData } = await supabase.from("profiles").select("*").in("id", ownerIds);
        const ownersMap = new Map(ownersData?.map((o) => [o.id, o]) || []);

        const listsWithStats = listsData
          .map((list) => ({
            ...list,
            pins_count: list.pins?.[0]?.count || 0,
            owner: ownersMap.get(list.user_id) as Profile,
          }))
          .filter((list) => list.pins_count > 0 && list.owner)
          .sort((a, b) => b.pins_count - a.pins_count);

        setTrendingLists(listsWithStats);
      }

      setIsLoading(false);
    };

    loadData();
  }, [isOpen]);

  // Search handler
  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!searchQuery.trim()) {
      setUsers([]);
      setLists([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      const supabase = createClient();

      if (tab === "users") {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
          .neq("id", currentUserId)
          .limit(20);

        if (profiles) {
          const { data: following } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", currentUserId);

          const followingIds = following?.map((f) => f.following_id) || [];

          const usersWithStats = await Promise.all(
            profiles.map(async (profile) => {
              const [listsResult, followersResult] = await Promise.all([
                supabase.from("lists").select("*", { count: "exact", head: true }).eq("user_id", profile.id).eq("is_public", true),
                supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
              ]);

              return {
                ...profile,
                lists_count: listsResult.count || 0,
                followers_count: followersResult.count || 0,
                is_following: followingIds.includes(profile.id),
              };
            })
          );

          setUsers(usersWithStats);
        }
      } else {
        const { data: listsData } = await supabase
          .from("lists")
          .select(`*, pins:pins(count)`)
          .eq("is_public", true)
          .ilike("name", `%${searchQuery}%`)
          .neq("user_id", currentUserId)
          .limit(20);

        if (listsData && listsData.length > 0) {
          const ownerIds = [...new Set(listsData.map((l) => l.user_id))];
          const { data: ownersData } = await supabase.from("profiles").select("*").in("id", ownerIds);
          const ownersMap = new Map(ownersData?.map((o) => [o.id, o]) || []);

          const listsWithStats = listsData
            .map((list) => ({
              ...list,
              pins_count: list.pins?.[0]?.count || 0,
              owner: ownersMap.get(list.user_id) as Profile,
            }))
            .filter((list) => list.owner);

          setLists(listsWithStats);
        } else {
          setLists([]);
        }
      }

      setIsSearching(false);
    }, 300);
  }, [tab, currentUserId]);

  const handleFollow = async (userId: string) => {
    if (!currentUserId) return;

    const supabase = createClient();

    const updateUsers = (list: UserWithStats[]) =>
      list.map((u) =>
        u.id === userId
          ? {
              ...u,
              is_following: !u.is_following,
              followers_count: u.is_following ? u.followers_count - 1 : u.followers_count + 1,
            }
          : u
      );

    setUsers(updateUsers);
    setSuggestedUsers(updateUsers);

    const user = [...users, ...suggestedUsers].find((u) => u.id === userId);
    if (!user) return;

    if (user.is_following) {
      await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", userId);
    } else {
      await supabase.from("follows").insert({ follower_id: currentUserId, following_id: userId });
    }
  };

  const handleNavigate = (path: string) => {
    onClose();
    router.push(path);
  };

  const displayUsers = query ? users : suggestedUsers;
  const displayLists = query ? lists : trendingLists;

  const tabs = [
    { id: "users" as SearchTab, label: "Users" },
    { id: "lists" as SearchTab, label: "Lists" },
  ];

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4 safe-area-top">
        {/* Close & Search Row */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-[--radius-md] bg-surface-elevated flex items-center justify-center hover:bg-surface-hover transition-colors shrink-0"
          >
            <CloseIcon />
          </button>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={tab === "users" ? "Search users..." : "Search lists..."}
              className="w-full bg-surface-elevated border border-border rounded-[--radius-md] pl-10 pr-4 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          tabs={tabs}
          activeTab={tab}
          onTabChange={(t) => {
            setTab(t as SearchTab);
            setQuery("");
            setUsers([]);
            setLists([]);
          }}
          variant="pill"
        />
      </div>

      {/* Content */}
      <div className="p-4 pb-20 overflow-y-auto h-[calc(100vh-140px)]">
        {isLoading || isSearching ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {tab === "users" ? (
              <motion.div
                key="users"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  {query ? "Search Results" : "Suggested"}
                </h2>

                {displayUsers.length > 0 ? (
                  <div className="space-y-2">
                    {displayUsers.map((user, index) => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="bg-surface-elevated rounded-[--radius-md] p-3"
                      >
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleNavigate(`/user/${user.username}`)}>
                            <Avatar
                              src={user.avatar_url}
                              alt={user.display_name || user.username}
                              fallback={(user.display_name || user.username)?.[0]}
                              size="md"
                            />
                          </button>
                          <button
                            onClick={() => handleNavigate(`/user/${user.username}`)}
                            className="flex-1 text-left min-w-0"
                          >
                            <p className="font-semibold text-text-primary truncate">
                              {user.display_name || user.username}
                            </p>
                            <p className="text-sm text-text-muted">@{user.username}</p>
                            <p className="text-xs text-text-secondary mt-0.5">
                              {user.lists_count} lists · {user.followers_count} followers
                            </p>
                          </button>
                          <Button
                            variant={user.is_following ? "secondary" : "primary"}
                            size="sm"
                            onClick={() => handleFollow(user.id)}
                          >
                            {user.is_following ? "Following" : "Follow"}
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="👥"
                    title={query ? "No users found" : "No suggested users"}
                    description={query ? "Try a different search" : "Users with lists will appear here"}
                  />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="lists"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  {query ? "Search Results" : "Trending"}
                </h2>

                {displayLists.length > 0 ? (
                  <div className="space-y-2">
                    {displayLists.map((list, index) => (
                      <motion.div
                        key={list.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <ListCard
                          list={list}
                          onClick={() => handleNavigate(`/lists/${list.id}`)}
                          showOwner
                          variant="row"
                        />
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="📋"
                    title={query ? "No lists found" : "No trending lists"}
                    description={query ? "Try a different search" : "Public lists will appear here"}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
