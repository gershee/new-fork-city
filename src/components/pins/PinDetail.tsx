"use client";

import { useRouter } from "next/navigation";
import { Button, Avatar, Badge, Card } from "@/components/ui";
import type { Pin } from "@/types";

interface PinDetailProps {
  pin: Pin;
  isOwn: boolean;
  onEdit: () => void;
}

export function PinDetail({ pin, isOwn, onEdit }: PinDetailProps) {
  const router = useRouter();
  const ratingStars = pin.personal_rating
    ? "★".repeat(pin.personal_rating)
    : null;

  return (
    <div className="space-y-4">
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
        {isOwn && (
          <Button variant="ghost" className="flex-1" onClick={onEdit}>
            <EditIcon />
            Edit
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
