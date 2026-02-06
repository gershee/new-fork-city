"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Avatar, Tabs, EmptyState, Header, BottomSheet } from "@/components/ui";
import { PinDetail } from "@/components/pins/PinDetail";
import { EditPinForm } from "@/components/pins/EditPinForm";
import { createClient } from "@/lib/supabase/client";
import type { Profile, List, Pin } from "@/types";

type ProfileTab = "lists" | "liked";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ lists: 0, pins: 0, followers: 0, following: 0 });
  const [myLists, setMyLists] = useState<(List & { pins_count: number })[]>([]);
  const [likedLists, setLikedLists] = useState<(List & { pins_count: number; owner?: Profile })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>("lists");

  // Expandable list state
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  const [listPins, setListPins] = useState<Record<string, Pin[]>>({});
  const [loadingPins, setLoadingPins] = useState<Set<string>>(new Set());
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [editingPin, setEditingPin] = useState<Pin | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchPinsForList = useCallback(async (listId: string) => {
    if (listPins[listId]) return;

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
    const fetchProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch stats
      const [listsResult, pinsResult, followersResult, followingResult] = await Promise.all([
        supabase.from("lists").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("pins").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
      ]);

      setStats({
        lists: listsResult.count || 0,
        pins: pinsResult.count || 0,
        followers: followersResult.count || 0,
        following: followingResult.count || 0,
      });

      // Fetch user's own lists
      const { data: listsData } = await supabase
        .from("lists")
        .select(`*, pins:pins(count)`)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(6);

      if (listsData) {
        setMyLists(listsData.map((l) => ({ ...l, pins_count: l.pins?.[0]?.count || 0 })));
      }

      // Fetch liked lists
      const { data: likedData } = await supabase
        .from("list_likes")
        .select("list_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (likedData && likedData.length > 0) {
        const listIds = likedData.map((l) => l.list_id);
        const { data: listsData } = await supabase
          .from("lists")
          .select(`*, pins:pins(count)`)
          .in("id", listIds)
          .eq("is_public", true);

        if (listsData) {
          const ownerIds = [...new Set(listsData.map((l) => l.user_id))];
          const { data: ownersData } = await supabase.from("profiles").select("*").in("id", ownerIds);
          const ownersMap = new Map(ownersData?.map((o) => [o.id, o]) || []);

          const orderedLists = listIds
            .map((id) => listsData.find((l) => l.id === id))
            .filter((l): l is typeof listsData[0] => l !== undefined)
            .map((l) => ({ ...l, pins_count: l.pins?.[0]?.count || 0, owner: ownersMap.get(l.user_id) }));

          setLikedLists(orderedLists);
        }
      }

      setIsLoading(false);
    };

    fetchProfile();
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: "lists" as ProfileTab, label: `Lists (${stats.lists})` },
    { id: "liked" as ProfileTab, label: `Liked (${likedLists.length})` },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header with settings */}
      <Header
        title=""
        rightAction={
          <button
            onClick={() => router.push("/profile/settings")}
            className="w-10 h-10 rounded-[--radius-md] bg-surface-elevated flex items-center justify-center hover:bg-surface-hover transition-colors"
          >
            <SettingsIcon />
          </button>
        }
        className="border-b-0"
      />

      {/* Profile Header */}
      <div className="px-4 pb-6">
        <div className="flex items-start gap-4">
          {/* Large Avatar */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Avatar
              src={profile?.avatar_url}
              alt={profile?.display_name || profile?.username}
              fallback={(profile?.display_name || profile?.username)?.[0]}
              size="xl"
            />
          </motion.div>

          {/* Info */}
          <div className="flex-1 pt-1">
            <h1 className="text-xl font-bold text-text-primary">
              {profile?.display_name || profile?.username}
            </h1>
            <p className="text-text-muted">@{profile?.username}</p>

            {/* Stats Row */}
            <div className="flex gap-4 mt-3">
              <button className="text-center" onClick={() => router.push("/lists")}>
                <span className="font-semibold text-text-primary">{stats.lists}</span>
                <span className="text-sm text-text-muted ml-1">lists</span>
              </button>
              <span className="text-border">·</span>
              <span className="text-center">
                <span className="font-semibold text-text-primary">{stats.pins}</span>
                <span className="text-sm text-text-muted ml-1">spots</span>
              </span>
              <span className="text-border">·</span>
              <span className="text-center">
                <span className="font-semibold text-text-primary">{stats.followers}</span>
                <span className="text-sm text-text-muted ml-1">followers</span>
              </span>
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile?.bio && (
          <p className="text-text-secondary mt-4 text-sm">{profile.bio}</p>
        )}

        {/* Edit Profile Button */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => router.push("/profile/edit")}
          >
            Edit Profile
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push("/discover")}
          >
            <UsersIcon />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 border-b border-border">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as ProfileTab)}
          variant="underline"
        />
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "lists" ? (
          <motion.div
            key="lists"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4"
          >
            {myLists.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No lists yet"
                description="Create your first list to start saving places"
                action={{
                  label: "Create List",
                  onClick: () => router.push("/lists"),
                }}
              />
            ) : (
              <>
                <div className="space-y-2">
                  {myLists.map((list, index) => (
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
                </div>
                {stats.lists > 6 && (
                  <Button
                    variant="ghost"
                    className="w-full mt-4"
                    onClick={() => router.push("/lists")}
                  >
                    View all {stats.lists} lists
                  </Button>
                )}
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="liked"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4"
          >
            {likedLists.length === 0 ? (
              <EmptyState
                icon="❤️"
                title="No liked lists"
                description="Discover lists and tap the heart to save them"
                action={{
                  label: "Discover Lists",
                  onClick: () => router.push("/feed"),
                }}
              />
            ) : (
              <div className="space-y-2">
                {likedLists.map((list, index) => (
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
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sign Out at bottom */}
      <div className="px-4 mt-8">
        <button
          onClick={handleSignOut}
          className="w-full py-3 text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          Sign Out
        </button>
      </div>

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
            lists={myLists}
            onSuccess={(updatedPin) => {
              setListPins((prev) => {
                const newPins = { ...prev };
                Object.keys(newPins).forEach((listId) => {
                  newPins[listId] = newPins[listId].filter((p) => p.id !== updatedPin.id);
                });
                if (newPins[updatedPin.list_id]) {
                  newPins[updatedPin.list_id] = [updatedPin, ...newPins[updatedPin.list_id]];
                }
                return newPins;
              });
              setEditingPin(null);
            }}
            onDelete={(pinId) => {
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
            {showOwner && list.owner && <>@{list.owner.username} • </>}
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
                <p className="text-sm text-text-muted text-center py-4">No spots yet</p>
              ) : (
                <div className="space-y-1">
                  {pins.map((pin) => (
                    <button
                      key={pin.id}
                      onClick={() => onPinClick(pin)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-[--radius-sm] hover:bg-surface-hover transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{pin.name}</p>
                        <p className="text-xs text-text-muted truncate">{pin.address}</p>
                      </div>
                      {pin.is_visited && <span className="text-xs text-status-visited shrink-0">✓</span>}
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

function ChevronDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
      <path d="m6 9 6 6 6-6" />
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

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
