"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Avatar, EmptyState } from "@/components/ui";
import type { List } from "@/types";

interface FollowedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  lists: List[];
}

interface LayersSheetProps {
  myLists: List[];
  followedUsers: FollowedUser[];
  enabledLayers: Set<string>;
  onToggleLayer: (listId: string) => void;
  onToggleAllForUser: (listIds: string[], enable: boolean) => void;
}

export function LayersSheet({
  myLists,
  followedUsers,
  enabledLayers,
  onToggleLayer,
  onToggleAllForUser,
}: LayersSheetProps) {
  const router = useRouter();

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto">
      {/* My Lists */}
      <section>
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          My Lists
        </h3>
        {myLists.length === 0 ? (
          <p className="text-text-muted text-sm py-2">No lists yet</p>
        ) : (
          <div className="space-y-1.5">
            {myLists.map((list) => (
              <LayerToggle
                key={list.id}
                list={list}
                enabled={enabledLayers.has(list.id)}
                onToggle={() => onToggleLayer(list.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Followed Users' Lists */}
      {followedUsers.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            From People You Follow
          </h3>
          <div className="space-y-3">
            {followedUsers.map((user) => (
              <UserListsGroup
                key={user.id}
                user={user}
                enabledLayers={enabledLayers}
                onToggleLayer={onToggleLayer}
                onToggleAll={(enable) => {
                  const listIds = user.lists.map((l) => l.id);
                  onToggleAllForUser(listIds, enable);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State for Following */}
      {followedUsers.length === 0 && (
        <EmptyState
          icon="👥"
          title="Follow people"
          description="See your friends' lists here"
          action={{
            label: "Find People",
            onClick: () => router.push("/discover"),
          }}
        />
      )}
    </div>
  );
}

// User Lists Group
function UserListsGroup({
  user,
  enabledLayers,
  onToggleLayer,
  onToggleAll,
}: {
  user: FollowedUser;
  enabledLayers: Set<string>;
  onToggleLayer: (listId: string) => void;
  onToggleAll: (enable: boolean) => void;
}) {
  const router = useRouter();
  const allEnabled = user.lists.every((l) => enabledLayers.has(l.id));

  return (
    <div className="bg-surface rounded-[--radius-md] overflow-hidden">
      {/* User Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <button
          onClick={() => router.push(`/user/${user.username}`)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Avatar
            src={user.avatar_url}
            alt={user.display_name || user.username}
            fallback={(user.display_name || user.username)?.[0]}
            size="xs"
          />
          <div className="text-left">
            <p className="text-sm font-medium text-text-primary">
              {user.display_name || user.username}
            </p>
            <p className="text-xs text-text-muted">
              {user.lists.length} {user.lists.length === 1 ? "list" : "lists"}
            </p>
          </div>
        </button>
        <button
          onClick={() => onToggleAll(!allEnabled)}
          className="text-xs text-primary px-2 py-1 font-medium"
        >
          {allEnabled ? "Hide all" : "Show all"}
        </button>
      </div>

      {/* User's Lists */}
      <div className="p-2 space-y-1">
        {user.lists.map((list) => (
          <LayerToggle
            key={list.id}
            list={list}
            enabled={enabledLayers.has(list.id)}
            onToggle={() => onToggleLayer(list.id)}
            compact
          />
        ))}
      </div>
    </div>
  );
}

// Layer Toggle Component
function LayerToggle({
  list,
  enabled,
  onToggle,
  compact = false,
}: {
  list: List;
  enabled: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-2.5 rounded-[--radius-sm] transition-all ${
        compact ? "hover:bg-surface-hover" : "bg-surface-elevated hover:bg-surface-hover"
      } ${enabled ? "opacity-100" : "opacity-50"}`}
    >
      <div
        className="w-8 h-8 rounded-[--radius-sm] flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${list.color}20` }}
      >
        <span className="text-base">{list.emoji_icon}</span>
      </div>
      <span className="flex-1 text-left text-text-primary text-sm font-medium truncate">
        {list.name}
      </span>
      <div
        className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
          enabled ? "bg-primary" : "bg-surface-elevated border border-border"
        }`}
      >
        <motion.div
          animate={{ x: enabled ? 16 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={`w-5 h-5 rounded-full shadow-sm ${
            enabled ? "bg-white" : "bg-text-muted"
          }`}
        />
      </div>
    </button>
  );
}
