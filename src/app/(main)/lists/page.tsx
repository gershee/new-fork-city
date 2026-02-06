"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button, BottomSheet, Header, Avatar, EmptyState } from "@/components/ui";
import { CreateListSheet } from "@/components/lists/CreateListSheet";
import { PinDetail } from "@/components/pins/PinDetail";
import { EditPinForm } from "@/components/pins/EditPinForm";
import { createClient } from "@/lib/supabase/client";
import type { List, Profile, Pin } from "@/types";

interface FollowedUserWithLists {
  profile: Profile;
  lists: (List & { pins_count: number })[];
}

export default function ListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<(List & { pins_count: number })[]>([]);
  const [followedUsersLists, setFollowedUsersLists] = useState<FollowedUserWithLists[]>([]);
  const [savedLists, setSavedLists] = useState<(List & { pins_count: number; owner?: Profile })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  const [listPins, setListPins] = useState<Record<string, Pin[]>>({});
  const [loadingPins, setLoadingPins] = useState<Set<string>>(new Set());
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [editingPin, setEditingPin] = useState<Pin | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchPinsForList = useCallback(async (listId: string) => {
    if (listPins[listId]) return; // Already fetched

    setLoadingPins((prev) => new Set(prev).add(listId));

    const supabase = createClient();
    const { data: pinsData } = await supabase
      .from("pins")
      .select("*")
      .eq("list_id", listId)
      .order("created_at", { ascending: false });

    if (pinsData) {
      setListPins((prev) => ({ ...prev, [listId]: pinsData }));
    }

    setLoadingPins((prev) => {
      const next = new Set(prev);
      next.delete(listId);
      return next;
    });
  }, [listPins]);

  const toggleListExpanded = useCallback((listId: string) => {
    setExpandedLists((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
        fetchPinsForList(listId);
      }
      return next;
    });
  }, [fetchPinsForList]);

  useEffect(() => {
    const fetchLists = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setCurrentUserId(user.id);

        // Fetch user's own lists with pin count
        const { data: listsData } = await supabase
          .from("lists")
          .select(`*, pins:pins(count)`)
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (listsData) {
          const listsWithCount = listsData.map((list) => ({
            ...list,
            pins_count: list.pins?.[0]?.count || 0,
          }));
          setLists(listsWithCount);
        }

        // Fetch followed users
        const { data: followsData } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);

        if (followsData && followsData.length > 0) {
          const followedIds = followsData.map((f) => f.following_id);

          const { data: profilesData } = await supabase
            .from("profiles")
            .select("*")
            .in("id", followedIds);

          const { data: followedListsData } = await supabase
            .from("lists")
            .select(`*, pins:pins(count)`)
            .in("user_id", followedIds)
            .eq("is_public", true)
            .order("updated_at", { ascending: false });

          if (profilesData && followedListsData) {
            const userListsMap = new Map<string, FollowedUserWithLists>();

            profilesData.forEach((profile) => {
              userListsMap.set(profile.id, { profile, lists: [] });
            });

            followedListsData.forEach((list) => {
              const userEntry = userListsMap.get(list.user_id);
              if (userEntry) {
                userEntry.lists.push({
                  ...list,
                  pins_count: list.pins?.[0]?.count || 0,
                });
              }
            });

            const usersWithLists = Array.from(userListsMap.values()).filter(
              (u) => u.profile && u.lists.length > 0
            );

            setFollowedUsersLists(usersWithLists);

            if (usersWithLists.length > 0) {
              setExpandedUsers(new Set([usersWithLists[0].profile.id]));
            }
          }
        }

        // Fetch saved/liked lists
        const { data: likedData } = await supabase
          .from("list_likes")
          .select("list_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (likedData && likedData.length > 0) {
          const likedListIds = likedData.map((l) => l.list_id);

          const { data: likedListsData } = await supabase
            .from("lists")
            .select(`*, pins:pins(count)`)
            .in("id", likedListIds)
            .neq("user_id", user.id)
            .eq("is_public", true);

          if (likedListsData) {
            const ownerIds = [...new Set(likedListsData.map((l) => l.user_id))];
            const { data: ownersData } = await supabase
              .from("profiles")
              .select("*")
              .in("id", ownerIds);

            const ownersMap = new Map(ownersData?.map((o) => [o.id, o]) || []);

            const orderedLists = likedListIds
              .map((id) => likedListsData.find((l) => l.id === id))
              .filter((l): l is typeof likedListsData[0] => l !== undefined)
              .map((l) => ({
                ...l,
                pins_count: l.pins?.[0]?.count || 0,
                owner: ownersMap.get(l.user_id),
              }));

            setSavedLists(orderedLists);
          }
        }
      } catch (error) {
        console.error("Error in fetchLists:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLists();
  }, [router]);

  const toggleUserExpanded = (userId: string) => {
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

  const handleCreateList = async (
    name: string,
    emoji: string,
    color: string,
    isPublic: boolean
  ) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("lists")
      .insert({
        user_id: user.id,
        name,
        emoji_icon: emoji,
        color,
        is_public: isPublic,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating list:", error);
      alert(`Failed to create list: ${error.message}`);
      return;
    }

    if (data) {
      setLists((prev) => [{ ...data, pins_count: 0 }, ...prev]);
      setShowCreateSheet(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header
        title="Lists"
        rightAction={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateSheet(true)}
          >
            <PlusIcon />
            New
          </Button>
        }
      />

      <div className="p-4">
        {/* My Lists */}
        {lists.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No lists yet"
            description="Create your first list to start saving places"
            action={{
              label: "Create Your First List",
              onClick: () => setShowCreateSheet(true),
            }}
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {lists.map((list, index) => (
                <motion.div
                  key={list.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <ExpandableListRow
                    list={list}
                    isExpanded={expandedLists.has(list.id)}
                    isLoading={loadingPins.has(list.id)}
                    pins={listPins[list.id] || []}
                    onToggle={() => toggleListExpanded(list.id)}
                    onPinClick={(pin) => setSelectedPin({ ...pin, list })}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Following Section */}
        {followedUsersLists.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <UsersIcon />
              <h2 className="text-lg font-semibold text-text-primary">Following</h2>
              <span className="text-sm text-text-muted">
                ({followedUsersLists.length})
              </span>
            </div>

            <div className="space-y-3">
              {followedUsersLists.map((userWithLists) => {
                const profile = userWithLists.profile;
                if (!profile) return null;

                return (
                  <motion.div
                    key={profile.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-surface-elevated rounded-[--radius-md] overflow-hidden"
                  >
                    {/* User Header */}
                    <div className="flex items-center justify-between p-4 hover:bg-surface-hover transition-colors">
                      <button
                        onClick={() => toggleUserExpanded(profile.id)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <Avatar
                          src={profile.avatar_url}
                          alt={profile.display_name || profile.username}
                          fallback={(profile.display_name || profile.username)?.[0]}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium text-text-primary">
                            {profile.display_name || profile.username}
                          </p>
                          <p className="text-sm text-text-secondary">
                            {userWithLists.lists.length} {userWithLists.lists.length === 1 ? "list" : "lists"}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/user/${profile.username}`)}
                          className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-[--radius-sm] hover:bg-primary/20 transition-colors"
                        >
                          Profile
                        </button>
                        <button
                          onClick={() => toggleUserExpanded(profile.id)}
                          className="p-1"
                        >
                          <motion.div
                            animate={{ rotate: expandedUsers.has(profile.id) ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDownIcon />
                          </motion.div>
                        </button>
                      </div>
                    </div>

                    {/* User's Lists */}
                    <AnimatePresence>
                      {expandedUsers.has(profile.id) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-2">
                            {userWithLists.lists.map((list) => (
                              <ExpandableListRow
                                key={list.id}
                                list={list}
                                isExpanded={expandedLists.has(list.id)}
                                isLoading={loadingPins.has(list.id)}
                                pins={listPins[list.id] || []}
                                onToggle={() => toggleListExpanded(list.id)}
                                onPinClick={(pin) => setSelectedPin({ ...pin, list })}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Saved Lists Section */}
        {savedLists.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <HeartIcon />
              <h2 className="text-lg font-semibold text-text-primary">Saved</h2>
              <span className="text-sm text-text-muted">({savedLists.length})</span>
            </div>

            <div className="space-y-2">
              {savedLists.map((list, index) => (
                <motion.div
                  key={list.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <ExpandableListRow
                    list={list}
                    isExpanded={expandedLists.has(list.id)}
                    isLoading={loadingPins.has(list.id)}
                    pins={listPins[list.id] || []}
                    onToggle={() => toggleListExpanded(list.id)}
                    onPinClick={(pin) => setSelectedPin({ ...pin, list })}
                    showOwner
                  />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state for social */}
        {lists.length > 0 && followedUsersLists.length === 0 && savedLists.length === 0 && (
          <EmptyState
            icon="👥"
            title="Find friends"
            description="Follow people to see their lists here"
            action={{
              label: "Discover People",
              onClick: () => router.push("/feed"),
            }}
            className="mt-8"
          />
        )}
      </div>

      {/* Create List Sheet */}
      <BottomSheet
        isOpen={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        title="Create a new list"
      >
        <CreateListSheet
          onSubmit={handleCreateList}
          onCancel={() => setShowCreateSheet(false)}
        />
      </BottomSheet>

      {/* Pin Detail Sheet */}
      <BottomSheet
        isOpen={selectedPin !== null && editingPin === null}
        onClose={() => setSelectedPin(null)}
        title={selectedPin?.name}
      >
        {selectedPin && (
          <PinDetail
            pin={selectedPin}
            isOwn={selectedPin.user_id === currentUserId}
            onEdit={() => {
              setEditingPin(selectedPin);
              setSelectedPin(null);
            }}
          />
        )}
      </BottomSheet>

      {/* Edit Pin Sheet */}
      <BottomSheet
        isOpen={editingPin !== null}
        onClose={() => setEditingPin(null)}
        title="Edit spot"
      >
        {editingPin && (
          <EditPinForm
            pin={editingPin}
            lists={lists}
            onSuccess={(updatedPin) => {
              // Update pin in the listPins cache
              setListPins((prev) => {
                const newPins = { ...prev };
                // Remove from old list if moved
                Object.keys(newPins).forEach((listId) => {
                  newPins[listId] = newPins[listId].filter((p) => p.id !== updatedPin.id);
                });
                // Add to new list
                if (newPins[updatedPin.list_id]) {
                  newPins[updatedPin.list_id] = [updatedPin, ...newPins[updatedPin.list_id]];
                }
                return newPins;
              });
              setEditingPin(null);
            }}
            onDelete={(pinId) => {
              // Remove pin from cache
              setListPins((prev) => {
                const newPins = { ...prev };
                Object.keys(newPins).forEach((listId) => {
                  newPins[listId] = newPins[listId].filter((p) => p.id !== pinId);
                });
                return newPins;
              });
              setEditingPin(null);
            }}
            onCancel={() => setEditingPin(null)}
          />
        )}
      </BottomSheet>
    </div>
  );
}

// Expandable List Row Component
function ExpandableListRow({
  list,
  isExpanded,
  isLoading,
  pins,
  onToggle,
  onPinClick,
  showOwner = false,
}: {
  list: List & { pins_count: number; owner?: Profile };
  isExpanded: boolean;
  isLoading: boolean;
  pins: Pin[];
  onToggle: () => void;
  onPinClick: (pin: Pin) => void;
  showOwner?: boolean;
}) {
  return (
    <div className="bg-surface rounded-[--radius-md] overflow-hidden">
      {/* List Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-surface-hover transition-colors text-left"
      >
        <div
          className="w-10 h-10 rounded-[--radius-sm] flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${list.color}20` }}
        >
          <span className="text-lg">{list.emoji_icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text-primary truncate">{list.name}</p>
          <p className="text-sm text-text-muted">
            {showOwner && list.owner && (
              <>@{list.owner.username} • </>
            )}
            {list.pins_count} {list.pins_count === 1 ? "spot" : "spots"}
            {!list.is_public && " • Private"}
          </p>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDownIcon />
        </motion.div>
      </button>

      {/* Expanded Pins */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pins.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">
                  No spots yet
                </p>
              ) : (
                <div className="space-y-1">
                  {pins.map((pin) => (
                    <button
                      key={pin.id}
                      onClick={() => onPinClick(pin)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-[--radius-sm] hover:bg-surface-hover transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {pin.name}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                          {pin.address}
                        </p>
                      </div>
                      {pin.is_visited && (
                        <span className="text-xs text-status-visited shrink-0">✓</span>
                      )}
                      <ChevronRightIcon />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Icons
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-red-400">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted shrink-0">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
