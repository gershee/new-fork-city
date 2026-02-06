"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui";
import type { List, Profile } from "@/types";

interface ListCardProps {
  list: List & { pins_count: number; owner?: Profile };
  onClick: () => void;
  showOwner?: boolean;
  variant?: "grid" | "row";
}

export function ListCard({
  list,
  onClick,
  showOwner = false,
  variant = "grid",
}: ListCardProps) {
  if (variant === "row") {
    return (
      <motion.button
        onClick={onClick}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center gap-3 p-3 bg-surface rounded-[--radius-md] hover:bg-surface-hover transition-colors text-left"
      >
        <div
          className="w-10 h-10 rounded-[--radius-sm] flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${list.color}20` }}
        >
          <span className="text-lg">{list.emoji_icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text-primary truncate">{list.name}</p>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            {showOwner && list.owner && (
              <>
                <span className="truncate">@{list.owner.username}</span>
                <span>·</span>
              </>
            )}
            <span>
              {list.pins_count} {list.pins_count === 1 ? "spot" : "spots"}
            </span>
          </div>
        </div>
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: list.color }}
        />
      </motion.button>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="relative bg-surface-elevated rounded-[--radius-md] p-4 text-left hover:bg-surface-hover transition-colors overflow-hidden"
    >
      {/* Subtle color accent */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ backgroundColor: list.color }}
      />

      {/* Emoji */}
      <div
        className="w-12 h-12 rounded-[--radius-md] flex items-center justify-center mb-3"
        style={{ backgroundColor: `${list.color}15` }}
      >
        <span className="text-2xl">{list.emoji_icon}</span>
      </div>

      {/* Info */}
      <h3 className="font-semibold text-text-primary mb-1 truncate">
        {list.name}
      </h3>
      <p className="text-sm text-text-secondary">
        {list.pins_count} {list.pins_count === 1 ? "spot" : "spots"}
      </p>

      {/* Private indicator */}
      {!list.is_public && (
        <div className="absolute top-3 right-3">
          <LockIcon />
        </div>
      )}

      {/* Owner badge */}
      {showOwner && list.owner && (
        <div className="mt-2">
          <Badge variant="default" size="sm">
            @{list.owner.username}
          </Badge>
        </div>
      )}
    </motion.button>
  );
}

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-text-muted"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
