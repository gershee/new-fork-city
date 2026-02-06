"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";

const EMOJI_OPTIONS = [
  "📍", "🍕", "🍔", "🍜", "🍣", "🍷", "🍺", "☕", "🍰", "🌮",
  "🥗", "🍝", "🥐", "🍦", "🎉", "❤️", "⭐", "🔥", "💎", "🌙",
];

const COLOR_OPTIONS = [
  "#f04e8c", // primary pink
  "#2dd4bf", // accent teal
  "#60a5fa", // blue
  "#a78bfa", // purple
  "#34d399", // green
  "#fbbf24", // amber
  "#f87171", // red
  "#fb923c", // orange
];

interface CreateListSheetProps {
  onSubmit: (name: string, emoji: string, color: string, isPublic: boolean) => Promise<void>;
  onCancel: () => void;
}

export function CreateListSheet({ onSubmit, onCancel }: CreateListSheetProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📍");
  const [color, setColor] = useState("#f04e8c");
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    await onSubmit(name.trim(), emoji, color, isPublic);
    setIsLoading(false);
  };

  return (
    <div className="space-y-5">
      {/* Name */}
      <Input
        label="List name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g., Best Pizza, Date Night"
        autoFocus
      />

      {/* Emoji */}
      <div>
        <label className="block text-sm text-text-secondary mb-2">Icon</label>
        <div className="flex flex-wrap gap-2">
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`w-10 h-10 rounded-[--radius-md] flex items-center justify-center text-xl transition-all ${
                emoji === e
                  ? "bg-primary/20 ring-2 ring-primary"
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
        <label className="block text-sm text-text-secondary mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-10 h-10 rounded-full transition-all ${
                color === c ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-110" : "hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div>
        <label className="block text-sm text-text-secondary mb-2">Preview</label>
        <div className="bg-surface rounded-[--radius-md] p-4 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-[--radius-md] flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <span className="text-2xl">{emoji}</span>
          </div>
          <div>
            <p className="font-semibold text-text-primary">
              {name || "List name"}
            </p>
            <p className="text-sm text-text-secondary">0 spots</p>
          </div>
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-sm text-text-secondary mb-2">Visibility</label>
        <div className="flex gap-2">
          <button
            onClick={() => setIsPublic(true)}
            className={`flex-1 px-4 py-3 rounded-[--radius-md] text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              isPublic
                ? "bg-accent/20 text-accent border-2 border-accent"
                : "bg-surface-elevated text-text-secondary border-2 border-transparent"
            }`}
          >
            <GlobeIcon />
            Public
          </button>
          <button
            onClick={() => setIsPublic(false)}
            className={`flex-1 px-4 py-3 rounded-[--radius-md] text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              !isPublic
                ? "bg-primary/20 text-primary border-2 border-primary"
                : "bg-surface-elevated text-text-secondary border-2 border-transparent"
            }`}
          >
            <LockIcon />
            Private
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2">
          {isPublic
            ? "Anyone can see this list and add it as a layer"
            : "Only you can see this list"}
        </p>
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
          Create List
        </Button>
      </div>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
