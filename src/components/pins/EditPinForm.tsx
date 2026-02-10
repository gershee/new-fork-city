"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Pin, List } from "@/types";

interface EditPinFormProps {
  pin: Pin;
  lists: List[];
  onSuccess: (pin: Pin) => void;
  onDelete: (pinId: string) => void;
  onCancel: () => void;
}

export function EditPinForm({
  pin,
  lists,
  onSuccess,
  onDelete,
  onCancel,
}: EditPinFormProps) {
  const [name, setName] = useState(pin.name);
  const [address, setAddress] = useState(pin.address);
  const [selectedListId, setSelectedListId] = useState(pin.list_id);
  const [isVisited, setIsVisited] = useState(pin.is_visited);
  const [rating, setRating] = useState<number | null>(pin.personal_rating);
  const [notes, setNotes] = useState(pin.personal_notes || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !selectedListId) return;

    setIsLoading(true);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("pins")
      .update({
        name: name.trim(),
        address: address.trim(),
        list_id: selectedListId,
        is_visited: isVisited,
        personal_rating: isVisited ? rating : null,
        personal_notes: notes.trim() || null,
      })
      .eq("id", pin.id)
      .select(
        `
        *,
        list:lists(id, name, emoji_icon, color, is_public)
      `
      )
      .single();

    if (error) {
      console.error("Error updating pin:", error);
      setIsLoading(false);
      return;
    }

    onSuccess(data as Pin);
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    const supabase = createClient();

    const { error } = await supabase.from("pins").delete().eq("id", pin.id);

    if (error) {
      console.error("Error deleting pin:", error);
      setIsDeleting(false);
      return;
    }

    onDelete(pin.id);
  };

  if (showDeleteConfirm) {
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <span className="text-4xl mb-4 block">🗑️</span>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Delete this spot?
          </h3>
          <p className="text-text-secondary">
            &quot;{pin.name}&quot; will be permanently removed from your list.
          </p>
        </div>

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
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            Delete
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm text-text-secondary mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What's this place called?"
          className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink"
        />
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm text-text-secondary mb-1.5">
          Address
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address"
          className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink"
        />
      </div>

      {/* List Selection */}
      {lists.length > 0 && (
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">List</label>
          <div className="flex flex-wrap gap-2">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors ${
                  selectedListId === list.id
                    ? "bg-neon-pink text-white"
                    : "bg-surface-elevated text-text-primary border border-border"
                }`}
              >
                <span>{list.emoji_icon}</span>
                <span>{list.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status Toggle */}
      <div>
        <label className="block text-sm text-text-secondary mb-1.5">
          Status
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setIsVisited(false)}
            className={`flex-1 px-4 py-2 rounded-xl text-sm transition-colors ${
              !isVisited
                ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan"
                : "bg-surface-elevated text-text-secondary border border-border"
            }`}
          >
            Want to try
          </button>
          <button
            onClick={() => setIsVisited(true)}
            className={`flex-1 px-4 py-2 rounded-xl text-sm transition-colors ${
              isVisited
                ? "bg-neon-green/20 text-neon-green border border-neon-green"
                : "bg-surface-elevated text-text-secondary border border-border"
            }`}
          >
            Been here
          </button>
        </div>
      </div>

      {/* Rating (only if visited) */}
      {isVisited && (
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">
            Rating
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(rating === star ? null : star)}
                className={`text-2xl transition-colors ${
                  rating && star <= rating
                    ? "text-neon-orange"
                    : "text-text-muted"
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm text-text-secondary mb-1.5">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you love about this place?"
          rows={3}
          className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="ghost"
          className="!text-red-400"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete
        </Button>
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={!name.trim() || !selectedListId}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
