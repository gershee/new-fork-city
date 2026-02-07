"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Avatar } from "@/components/ui";
import type { Pin, List, Profile } from "@/types";

interface SavedByInfo {
  pin: Pin;
  list: List;
  owner: Profile;
}

interface PinDetailProps {
  pin: Pin;
  isOwn: boolean;
  onEdit: () => void;
  savedBy?: SavedByInfo[];
  isLoadingSavedBy?: boolean;
  onSaveToList?: () => void;
}

type SortOption = "saves" | "rating" | "recent";

export function PinDetail({ pin, isOwn, onEdit, savedBy = [], isLoadingSavedBy, onSaveToList }: PinDetailProps) {
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortOption>("saves");

  // Calculate stats
  const totalSaves = savedBy.length + 1; // +1 for current pin
  const avgRating = useMemo(() => {
    const allPins = [pin, ...savedBy.map(s => s.pin)];
    const ratedPins = allPins.filter(p => p.personal_rating);
    if (ratedPins.length === 0) return 0;
    return ratedPins.reduce((sum, p) => sum + (p.personal_rating || 0), 0) / ratedPins.length;
  }, [pin, savedBy]);

  const visitedCount = useMemo(() => {
    const allPins = [pin, ...savedBy.map(s => s.pin)];
    return allPins.filter(p => p.is_visited).length;
  }, [pin, savedBy]);

  // Sort saved by
  const sortedSavedBy = useMemo(() => {
    const items = [...savedBy];
    switch (sortBy) {
      case "rating":
        return items.sort((a, b) => (b.pin.personal_rating || 0) - (a.pin.personal_rating || 0));
      case "recent":
        return items.sort((a, b) => new Date(b.pin.created_at).getTime() - new Date(a.pin.created_at).getTime());
      default:
        return items;
    }
  }, [savedBy, sortBy]);

  // Get unique lists
  const uniqueLists = useMemo(() => {
    const listMap = new Map<string, { list: List; count: number }>();
    // Add current pin's list
    if (pin.list) {
      listMap.set(pin.list.id, { list: pin.list, count: 1 });
    }
    // Add saved by lists
    savedBy.forEach(({ list }) => {
      if (!listMap.has(list.id)) {
        listMap.set(list.id, { list, count: 1 });
      } else {
        listMap.get(list.id)!.count++;
      }
    });
    return Array.from(listMap.values());
  }, [pin, savedBy]);

  const isHot = totalSaves >= 5;

  return (
    <div className="space-y-4">
      {/* Address & Category */}
      <div>
        <p className="text-text-secondary">{pin.address}</p>
        {pin.category && (
          <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-surface text-text-muted">
            {pin.category.split(",")[0]}
          </span>
        )}
      </div>

      {/* Stats Box */}
      {!isLoadingSavedBy && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-surface rounded-xl p-3 ${isHot ? "hot-glow" : ""}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-bold text-neon-pink">{totalSaves}</p>
                <p className="text-xs text-text-muted">saves</p>
              </div>
              {avgRating > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-neon-orange">{avgRating.toFixed(1)}★</p>
                  <p className="text-xs text-text-muted">avg rating</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-lg font-bold text-neon-green">{visitedCount}</p>
                <p className="text-xs text-text-muted">visited</p>
              </div>
            </div>
            {isHot && (
              <motion.span
                className="text-2xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                🔥
              </motion.span>
            )}
          </div>
        </motion.div>
      )}

      {/* Owner info for friend's pins */}
      {!isOwn && pin.owner && (
        <button
          onClick={() => router.push(`/user/${pin.owner!.username}`)}
          className="flex items-center gap-3 w-full bg-surface rounded-xl p-3 hover:bg-surface-hover transition-colors"
        >
          <Avatar
            src={pin.owner.avatar_url}
            alt={pin.owner.display_name || pin.owner.username}
            fallback={(pin.owner.display_name || pin.owner.username)?.[0]}
            size="sm"
          />
          <div className="text-left">
            <p className="font-medium text-text-primary">
              {pin.owner.display_name || pin.owner.username}
            </p>
            <p className="text-xs text-text-muted">View profile</p>
          </div>
        </button>
      )}

      {/* On X lists */}
      {!isLoadingSavedBy && uniqueLists.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-2">
            On {uniqueLists.length} {uniqueLists.length === 1 ? "list" : "lists"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {uniqueLists.slice(0, 5).map(({ list }) => (
              <button
                key={list.id}
                onClick={() => router.push(`/lists/${list.id}`)}
                className="px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 bg-surface-elevated hover:bg-surface-hover transition-colors"
                style={{ borderColor: list.color, borderWidth: 1 }}
              >
                <span>{list.emoji_icon}</span>
                <span>{list.name}</span>
              </button>
            ))}
            {uniqueLists.length > 5 && (
              <span className="px-2 py-1.5 text-xs text-text-muted">+{uniqueLists.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      {/* Your rating & notes (if own pin) */}
      {isOwn && (pin.personal_rating || pin.personal_notes) && (
        <div className="bg-surface rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            {pin.personal_rating && (
              <span className="text-neon-orange">{"★".repeat(pin.personal_rating)}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              pin.is_visited
                ? "bg-neon-green/20 text-neon-green"
                : "bg-neon-cyan/20 text-neon-cyan"
            }`}>
              {pin.is_visited ? "Been here" : "Want to try"}
            </span>
          </div>
          {pin.personal_notes && (
            <p className="text-sm text-text-secondary">{pin.personal_notes}</p>
          )}
        </div>
      )}

      {/* Saved by section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-secondary">Saved by</h3>
          {savedBy.length > 1 && (
            <div className="flex gap-1">
              {(["saves", "rating", "recent"] as SortOption[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setSortBy(option)}
                  className={`px-2 py-1 rounded-md text-xs transition-colors ${
                    sortBy === option ? "bg-neon-pink text-white" : "bg-surface text-text-muted hover:text-text-primary"
                  }`}
                >
                  {option === "saves" ? "Popular" : option === "rating" ? "Rating" : "Recent"}
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoadingSavedBy ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
          </div>
        ) : savedBy.length === 0 ? (
          <div className="text-center py-4 bg-surface rounded-xl">
            <p className="text-2xl mb-2">✨</p>
            <p className="text-sm text-text-muted">Be the first to save this place!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSavedBy.map(({ pin: savedPin, list, owner }) => (
              <button
                key={savedPin.id}
                onClick={() => router.push(`/lists/${list.id}`)}
                className="w-full flex items-center gap-3 p-3 bg-surface rounded-xl hover:bg-surface-hover transition-colors text-left"
              >
                <Avatar
                  src={owner.avatar_url}
                  alt={owner.display_name || owner.username}
                  fallback={(owner.display_name || owner.username)?.[0]}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">
                    {owner.display_name || owner.username}
                  </p>
                  <p className="text-sm text-text-muted truncate">
                    {list.emoji_icon} {list.name}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {savedPin.personal_rating && (
                    <span className="text-sm text-neon-orange">{"★".repeat(savedPin.personal_rating)}</span>
                  )}
                  {savedPin.is_visited && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-neon-green/20 text-neon-green">✓</span>
                  )}
                </div>
                <ChevronRightIcon />
              </button>
            ))}
            {savedBy.length > 5 && (
              <p className="text-xs text-text-muted text-center pt-1">
                +{savedBy.length - 5} more
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => {
            window.open(
              `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`,
              "_blank"
            );
          }}
        >
          <DirectionsIcon />
          Directions
        </Button>
        {isOwn ? (
          <Button variant="ghost" className="flex-1" onClick={onEdit}>
            <EditIcon />
            Edit
          </Button>
        ) : onSaveToList && (
          <Button variant="primary" className="flex-1" onClick={onSaveToList}>
            <SaveIcon />
            Save
          </Button>
        )}
      </div>
    </div>
  );
}

function DirectionsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted shrink-0">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
