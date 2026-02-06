"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Avatar, Badge, Card } from "@/components/ui";
import { ShimmerEffect, HotGlowRing } from "@/components/effects";
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

export function PinDetail({ pin, isOwn, onEdit, savedBy = [], isLoadingSavedBy, onSaveToList }: PinDetailProps) {
  const router = useRouter();
  const ratingStars = pin.personal_rating
    ? "★".repeat(pin.personal_rating)
    : null;

  // Calculate popularity (viral meter)
  const totalSaves = savedBy.length + 1; // +1 for current pin
  const getViralLevel = (count: number) => {
    if (count >= 10) return { label: "🔥 Hot spot", color: "text-orange-400", percent: 100 };
    if (count >= 5) return { label: "📈 Popular", color: "text-neon-pink", percent: 70 };
    if (count >= 3) return { label: "⭐ Rising", color: "text-neon-cyan", percent: 40 };
    if (count >= 2) return { label: "💫 Shared", color: "text-neon-purple", percent: 20 };
    return null;
  };
  const viralLevel = getViralLevel(totalSaves);

  return (
    <div className="space-y-4">
      {/* Viral meter / popularity indicator */}
      {viralLevel && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-surface rounded-xl p-3 relative overflow-hidden ${totalSaves >= 10 ? "hot-glow" : ""}`}
        >
          {/* Hot spot glow ring */}
          {totalSaves >= 10 && <HotGlowRing className="rounded-xl" />}

          <div className="flex items-center justify-between mb-2">
            <motion.span
              className={`text-sm font-medium ${viralLevel.color} flex items-center gap-1.5`}
              animate={totalSaves >= 10 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {viralLevel.label}
            </motion.span>
            <span className="text-xs text-text-muted">
              Saved by {totalSaves} {totalSaves === 1 ? "person" : "people"}
            </span>
          </div>
          <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden relative">
            <motion.div
              className="h-full bg-gradient-to-r from-neon-cyan via-neon-pink to-orange-400 rounded-full relative overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: `${viralLevel.percent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <ShimmerEffect />
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Owner info for friend's pins */}
      {!isOwn && pin.owner && (
        <button
          onClick={() => router.push(`/user/${pin.owner!.username}`)}
          className="flex items-center gap-3 w-full bg-surface rounded-[--radius-md] p-3 hover:bg-surface-hover transition-colors"
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

      {/* List badge */}
      {pin.list && (
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
          style={{ backgroundColor: `${pin.list.color}20` }}
        >
          <span>{pin.list.emoji_icon}</span>
          <span style={{ color: pin.list.color }}>{pin.list.name}</span>
        </div>
      )}

      {/* Address */}
      <p className="text-text-secondary">{pin.address}</p>

      {/* Rating & Status */}
      <div className="flex items-center gap-2 flex-wrap">
        {ratingStars && (
          <Badge variant="rating" size="md">
            {ratingStars}
          </Badge>
        )}
        <Badge variant={pin.is_visited ? "visited" : "want"} size="md">
          {pin.is_visited ? "Been here" : "Want to try"}
        </Badge>
      </div>

      {/* Notes */}
      {pin.personal_notes && (
        <Card variant="elevated" padding="md">
          <p className="text-text-primary text-sm">{pin.personal_notes}</p>
        </Card>
      )}

      {/* Also saved by section with stacked avatars */}
      {(savedBy.length > 0 || isLoadingSavedBy) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-text-secondary">Also saved by</p>
            {savedBy.length > 0 && !isLoadingSavedBy && (
              <div className="avatar-stack flex items-center">
                {savedBy.slice(0, 4).map(({ owner }, i) => (
                  <motion.div
                    key={owner.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Avatar
                      src={owner.avatar_url}
                      alt={owner.display_name || owner.username}
                      fallback={(owner.display_name || owner.username)?.[0]}
                      size="xs"
                    />
                  </motion.div>
                ))}
                {savedBy.length > 4 && (
                  <div className="w-6 h-6 rounded-full bg-surface-elevated border-2 border-surface flex items-center justify-center text-xs text-text-muted font-medium ml-[-8px]">
                    +{savedBy.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>
          {isLoadingSavedBy ? (
            <div className="flex items-center justify-center py-3">
              <div className="w-4 h-4 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {savedBy.slice(0, 5).map(({ pin: savedPin, list, owner }, index) => (
                <motion.button
                  key={savedPin.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => router.push(`/user/${owner.username}`)}
                  className="w-full flex items-center gap-3 p-2.5 bg-surface rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <Avatar
                    src={owner.avatar_url}
                    alt={owner.display_name || owner.username}
                    fallback={(owner.display_name || owner.username)?.[0]}
                    size="xs"
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {owner.display_name || owner.username}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {list.emoji_icon} {list.name}
                    </p>
                  </div>
                  <ChevronRightIcon />
                </motion.button>
              ))}
              {savedBy.length > 5 && (
                <p className="text-xs text-text-muted text-center pt-1">
                  +{savedBy.length - 5} more
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}

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
