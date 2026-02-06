"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MapView } from "@/components/map/MapView";
import { Button, BottomSheet } from "@/components/ui";
import { EditPinForm } from "@/components/pins/EditPinForm";
import { LikeButton } from "@/components/social/LikeButton";
import { createClient } from "@/lib/supabase/client";
import type { List, Pin } from "@/types";

const EMOJI_OPTIONS = [
  "📍", "🍕", "🍔", "🍜", "🍣", "🍷", "🍺", "☕", "🍰", "🌮",
  "🥗", "🍝", "🥐", "🍦", "🎉", "❤️", "⭐", "🔥", "💎", "🌙",
];

const COLOR_OPTIONS = [
  "#ff2d92", "#00f0ff", "#b14eff", "#39ff14",
  "#ff6b35", "#ffd700", "#ff6b6b", "#4ecdc4",
];

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params.id as string;

  const [list, setList] = useState<List | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [editingPin, setEditingPin] = useState<Pin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<"map" | "list">("list");
  const [allLists, setAllLists] = useState<List[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [listOwner, setListOwner] = useState<{ username: string; display_name: string | null; avatar_url: string | null } | null>(null);
  const [showListMenu, setShowListMenu] = useState(false);
  const [showEditList, setShowEditList] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Fetch list
      const { data: listData, error: listError } = await supabase
        .from("lists")
        .select("*")
        .eq("id", listId)
        .single();

      if (listError || !listData) {
        router.push("/lists");
        return;
      }

      setList(listData);

      // Fetch pins
      const { data: pinsData } = await supabase
        .from("pins")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: false });

      if (pinsData) {
        // Add list info to each pin for MapView
        setPins(
          pinsData.map((pin) => ({
            ...pin,
            list: listData,
          }))
        );
      }

      // Fetch all user's lists (for moving pins) and check ownership
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const isOwnerCheck = listData.user_id === user.id;
        setIsOwner(isOwnerCheck);

        // Fetch owner info if not the current user
        if (!isOwnerCheck) {
          const { data: ownerData } = await supabase
            .from("profiles")
            .select("username, display_name, avatar_url")
            .eq("id", listData.user_id)
            .single();
          if (ownerData) {
            setListOwner(ownerData);
          }
        }

        const { data: listsData } = await supabase
          .from("lists")
          .select("*")
          .eq("user_id", user.id)
          .order("name");
        if (listsData) {
          setAllLists(listsData);
        }

        // Check if user has liked this list
        const { data: likeData } = await supabase
          .from("list_likes")
          .select("*")
          .eq("list_id", listId)
          .eq("user_id", user.id)
          .single();

        setIsLiked(!!likeData);
      }

      // Get like count for this list
      const { count: likesCount } = await supabase
        .from("list_likes")
        .select("*", { count: "exact", head: true })
        .eq("list_id", listId);

      setLikeCount(likesCount || 0);

      setIsLoading(false);
    };

    fetchData();
  }, [listId, router]);

  const handleDeleteList = async () => {
    if (!list) return;
    setIsDeleting(true);

    const supabase = createClient();
    const { error } = await supabase.from("lists").delete().eq("id", list.id);

    if (!error) {
      router.push("/lists");
    } else {
      console.error("Error deleting list:", error);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleListUpdated = (updatedList: List) => {
    setList(updatedList);
    // Update list info on all pins
    setPins((prev) => prev.map((pin) => ({ ...pin, list: updatedList })));
    setShowEditList(false);
  };

  const handleCopyList = async () => {
    if (!list) return;
    setIsCopying(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setIsCopying(false);
      return;
    }

    // Create a copy of the list
    const { data: newList, error: listError } = await supabase
      .from("lists")
      .insert({
        user_id: user.id,
        name: `${list.name} (copy)`,
        description: list.description,
        emoji_icon: list.emoji_icon,
        color: list.color,
        is_public: false, // Default copied lists to private
      })
      .select()
      .single();

    if (listError || !newList) {
      console.error("Error copying list:", listError);
      setIsCopying(false);
      setShowCopyConfirm(false);
      return;
    }

    // Copy all pins to the new list
    if (pins.length > 0) {
      const pinsCopy = pins.map((pin) => ({
        list_id: newList.id,
        user_id: user.id,
        place_id: pin.place_id,
        name: pin.name,
        address: pin.address,
        lat: pin.lat,
        lng: pin.lng,
        category: pin.category,
        is_visited: false, // Reset visited status
      }));

      const { error: pinsError } = await supabase.from("pins").insert(pinsCopy);

      if (pinsError) {
        console.error("Error copying pins:", pinsError);
      }
    }

    setIsCopying(false);
    setShowCopyConfirm(false);
    router.push(`/lists/${newList.id}`);
  };

  const handleDeletePin = async (pinId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("pins").delete().eq("id", pinId);

    if (!error) {
      setPins((prev) => prev.filter((p) => p.id !== pinId));
      setSelectedPin(null);
    }
  };

  const handleToggleVisited = async (pin: Pin) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("pins")
      .update({ is_visited: !pin.is_visited })
      .eq("id", pin.id);

    if (!error) {
      setPins((prev) =>
        prev.map((p) =>
          p.id === pin.id ? { ...p, is_visited: !p.is_visited } : p
        )
      );
      if (selectedPin?.id === pin.id) {
        setSelectedPin({ ...selectedPin, is_visited: !selectedPin.is_visited });
      }
    }
  };

  const handleEditPin = (pin: Pin) => {
    setSelectedPin(null);
    setEditingPin(pin);
  };

  const handlePinUpdated = (updatedPin: Pin) => {
    // If pin was moved to a different list, remove it from current view
    if (updatedPin.list_id !== listId) {
      setPins((prev) => prev.filter((p) => p.id !== updatedPin.id));
    } else {
      // Update the pin in the list
      const updatedWithList: Pin = { ...updatedPin, list: list || undefined };
      setPins((prev) =>
        prev.map((p) => (p.id === updatedPin.id ? updatedWithList : p))
      );
    }
    setEditingPin(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!list) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center hover:bg-surface-hover transition-colors"
          >
            <BackIcon />
          </button>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${list.color}20` }}
          >
            <span className="text-xl">{list.emoji_icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-text-primary truncate">{list.name}</h1>
            <p className="text-sm text-text-secondary">
              {pins.length} {pins.length === 1 ? "spot" : "spots"}
              {!list.is_public && isOwner && " • Private"}
              {!isOwner && listOwner && (
                <span> • by @{listOwner.username}</span>
              )}
            </p>
            {list.description && (
              <p className="text-xs text-text-muted mt-1 line-clamp-1">
                {list.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Like button - show for everyone */}
            <LikeButton
              type="list"
              targetId={listId}
              initialLiked={isLiked}
              initialCount={likeCount}
              size="md"
            />

            {isOwner ? (
              <button
                onClick={() => setShowListMenu(true)}
                className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center hover:bg-surface-hover transition-colors"
              >
                <MoreIcon />
              </button>
            ) : (
              <button
                onClick={() => setShowCopyConfirm(true)}
                className="px-3 py-2 rounded-xl bg-neon-pink/20 text-neon-pink text-sm font-medium hover:bg-neon-pink/30 transition-colors flex items-center gap-1.5"
              >
                <CopyIcon className="w-4 h-4" />
                Copy
              </button>
            )}
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setView("list")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === "list"
                ? "bg-surface-elevated text-text-primary"
                : "text-text-muted"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setView("map")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === "map"
                ? "bg-surface-elevated text-text-primary"
                : "text-text-muted"
            }`}
          >
            Map
          </button>
        </div>
      </div>

      {/* Content */}
      {view === "list" ? (
        <div className="p-4">
          {pins.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl mb-4 block">{list.emoji_icon}</span>
              <h2 className="text-lg font-semibold text-text-primary mb-2">
                No spots yet
              </h2>
              <p className="text-text-secondary mb-4">
                Search for places to add to this list
              </p>
              <Button variant="primary" onClick={() => router.push("/search")}>
                Find Places
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {pins.map((pin, index) => (
                  <motion.div
                    key={pin.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedPin(pin)}
                    className="bg-surface-elevated rounded-xl p-4 cursor-pointer hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-text-primary truncate">
                          {pin.name}
                        </h3>
                        <p className="text-sm text-text-secondary truncate mt-0.5">
                          {pin.address}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                              pin.is_visited
                                ? "bg-neon-green/20 text-neon-green"
                                : "bg-neon-cyan/20 text-neon-cyan"
                            }`}
                          >
                            {pin.is_visited ? "Been here" : "Want to try"}
                          </span>
                          {pin.personal_rating && (
                            <span className="text-xs text-neon-orange">
                              {"★".repeat(pin.personal_rating)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRightIcon className="w-5 h-5 text-text-muted shrink-0 ml-2" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        <div className="h-[calc(100vh-180px)]">
          <MapView
            pins={pins}
            onPinClick={setSelectedPin}
            center={
              pins.length > 0
                ? [pins[0].lng, pins[0].lat]
                : [-73.985428, 40.748817]
            }
            zoom={pins.length > 0 ? 13 : 12}
          />
        </div>
      )}

      {/* Pin Detail Sheet */}
      <BottomSheet
        isOpen={selectedPin !== null && editingPin === null}
        onClose={() => setSelectedPin(null)}
        title={selectedPin?.name}
      >
        {selectedPin && (
          <div className="space-y-4">
            <p className="text-text-secondary">{selectedPin.address}</p>

            {/* Status */}
            <button
              onClick={() => handleToggleVisited(selectedPin)}
              className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                selectedPin.is_visited
                  ? "bg-neon-green/20 text-neon-green"
                  : "bg-neon-cyan/20 text-neon-cyan"
              }`}
            >
              {selectedPin.is_visited
                ? "✓ Been here — tap to mark as want to try"
                : "Want to try — tap to mark as visited"}
            </button>

            {/* Rating */}
            {selectedPin.personal_rating && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">Rating:</span>
                <span className="text-neon-orange">
                  {"★".repeat(selectedPin.personal_rating)}
                  {"☆".repeat(5 - selectedPin.personal_rating)}
                </span>
              </div>
            )}

            {/* Notes */}
            {selectedPin.personal_notes && (
              <div className="bg-surface rounded-xl p-4">
                <p className="text-text-primary">{selectedPin.personal_notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${selectedPin.lat},${selectedPin.lng}`,
                    "_blank"
                  );
                }}
              >
                Directions
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => handleEditPin(selectedPin)}
              >
                Edit
              </Button>
              <PinLikeButton pinId={selectedPin.id} />
            </div>
          </div>
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
            lists={allLists}
            onSuccess={handlePinUpdated}
            onDelete={(pinId) => {
              handleDeletePin(pinId);
              setEditingPin(null);
            }}
            onCancel={() => setEditingPin(null)}
          />
        )}
      </BottomSheet>

      {/* List Menu Sheet */}
      <BottomSheet
        isOpen={showListMenu}
        onClose={() => setShowListMenu(false)}
        title="List options"
      >
        <div className="space-y-2">
          <button
            onClick={() => {
              setShowListMenu(false);
              setShowEditList(true);
            }}
            className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-surface-hover transition-colors"
          >
            <EditIcon className="w-5 h-5 text-text-secondary" />
            <span className="text-text-primary">Edit list</span>
          </button>
          <button
            onClick={() => {
              setShowListMenu(false);
              setShowDeleteConfirm(true);
            }}
            className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-surface-hover transition-colors text-red-400"
          >
            <TrashIcon className="w-5 h-5" />
            <span>Delete list</span>
          </button>
        </div>
      </BottomSheet>

      {/* Edit List Sheet */}
      <BottomSheet
        isOpen={showEditList}
        onClose={() => setShowEditList(false)}
        title="Edit list"
      >
        {list && (
          <EditListForm
            list={list}
            onSuccess={handleListUpdated}
            onCancel={() => setShowEditList(false)}
          />
        )}
      </BottomSheet>

      {/* Delete Confirmation Sheet */}
      <BottomSheet
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete list?"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            Are you sure you want to delete &quot;{list?.name}&quot;? This will also delete all {pins.length} spots in this list. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1 !bg-red-500 hover:!bg-red-600"
              onClick={handleDeleteList}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Copy Confirmation Sheet */}
      <BottomSheet
        isOpen={showCopyConfirm}
        onClose={() => setShowCopyConfirm(false)}
        title="Copy list?"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-surface rounded-xl">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${list?.color}20` }}
            >
              <span className="text-2xl">{list?.emoji_icon}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-text-primary truncate">{list?.name}</p>
              <p className="text-sm text-text-secondary">
                {pins.length} {pins.length === 1 ? "spot" : "spots"} will be copied
              </p>
            </div>
          </div>
          <p className="text-text-muted text-sm">
            This will create a private copy of this list in your account. You can then edit it however you like.
          </p>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setShowCopyConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleCopyList}
              isLoading={isCopying}
            >
              Copy List
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// Edit List Form Component
function EditListForm({
  list,
  onSuccess,
  onCancel,
}: {
  list: List;
  onSuccess: (list: List) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description || "");
  const [emoji, setEmoji] = useState(list.emoji_icon);
  const [color, setColor] = useState(list.color);
  const [isPublic, setIsPublic] = useState(list.is_public);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("List name is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("lists")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        emoji_icon: emoji,
        color,
        is_public: isPublic,
      })
      .eq("id", list.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating list:", updateError);
      setError("Failed to update list");
      setIsLoading(false);
      return;
    }

    if (data) {
      onSuccess(data);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm text-text-secondary mb-1.5">
          List name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Best Pizza"
          className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm text-text-secondary mb-1.5">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this list about?"
          maxLength={200}
          rows={2}
          className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink resize-none"
        />
      </div>

      {/* Emoji */}
      <div>
        <label className="block text-sm text-text-secondary mb-1.5">Icon</label>
        <div className="flex flex-wrap gap-2">
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                emoji === e
                  ? "bg-neon-pink/20 ring-2 ring-neon-pink"
                  : "bg-surface-elevated hover:bg-surface-hover"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="block text-sm text-text-secondary mb-1.5">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-10 h-10 rounded-full transition-all ${
                color === c ? "ring-2 ring-white ring-offset-2 ring-offset-background" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-sm text-text-secondary mb-1.5">Visibility</label>
        <div className="flex gap-2">
          <button
            onClick={() => setIsPublic(true)}
            className={`flex-1 px-4 py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${
              isPublic
                ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan"
                : "bg-surface-elevated text-text-secondary border border-border"
            }`}
          >
            <GlobeIcon className="w-4 h-4" />
            Public
          </button>
          <button
            onClick={() => setIsPublic(false)}
            className={`flex-1 px-4 py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${
              !isPublic
                ? "bg-neon-purple/20 text-neon-purple border border-neon-purple"
                : "bg-surface-elevated text-text-secondary border border-border"
            }`}
          >
            <LockIcon className="w-4 h-4" />
            Private
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={!name.trim()}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// Icons
function BackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// Pin Like Button - fetches its own like state
function PinLikeButton({ pinId }: { pinId: string }) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const fetchLikeStatus = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: likeData } = await supabase
          .from("pin_likes")
          .select("*")
          .eq("pin_id", pinId)
          .eq("user_id", user.id)
          .single();

        setIsLiked(!!likeData);
      }

      const { count } = await supabase
        .from("pin_likes")
        .select("*", { count: "exact", head: true })
        .eq("pin_id", pinId);

      setLikeCount(count || 0);
      setIsLoaded(true);
    };

    fetchLikeStatus();
  }, [pinId]);

  if (!isLoaded) {
    return (
      <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <LikeButton
      type="pin"
      targetId={pinId}
      initialLiked={isLiked}
      initialCount={likeCount}
      size="md"
      showCount={false}
    />
  );
}
