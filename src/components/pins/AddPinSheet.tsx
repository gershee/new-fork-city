"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button, Input, Badge, useToast, getRandomToast } from "@/components/ui";
import { fireConfetti } from "@/components/effects";
import { createClient } from "@/lib/supabase/client";
import type { Pin, List } from "@/types";

interface AddPinSheetProps {
  location: { lng: number; lat: number };
  lists: List[];
  onSuccess: (pin: Pin) => void;
  onCancel: () => void;
}

export function AddPinSheet({
  location,
  lists,
  onSuccess,
  onCancel,
}: AddPinSheetProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [selectedListId, setSelectedListId] = useState(lists[0]?.id || "");
  const [isVisited, setIsVisited] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(true);
  const { showToast } = useToast();

  // Reverse geocode the location
  useEffect(() => {
    const reverseGeocode = async () => {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${location.lng},${location.lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
        );
        const data = await response.json();

        if (data.features?.[0]) {
          const feature = data.features[0];
          setAddress(feature.place_name || "");
          const placeName = feature.text || feature.place_name?.split(",")[0] || "";
          setName(placeName);
        }
      } catch (error) {
        console.error("Reverse geocoding error:", error);
      } finally {
        setIsReverseGeocoding(false);
      }
    };

    reverseGeocode();
  }, [location]);

  const handleSubmit = async () => {
    if (!name.trim() || !selectedListId) return;

    setIsLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("pins")
      .insert({
        user_id: user.id,
        list_id: selectedListId,
        name: name.trim(),
        address: address.trim(),
        lat: location.lat,
        lng: location.lng,
        is_visited: isVisited,
        personal_rating: rating,
        personal_notes: notes.trim() || null,
      })
      .select(`*, list:lists(id, name, emoji_icon, color, is_public)`)
      .single();

    if (error) {
      console.error("Error creating pin:", error);
      showToast(getRandomToast("error"));
      setIsLoading(false);
      return;
    }

    // Celebrate the save!
    fireConfetti("save");
    showToast(getRandomToast("save"));
    onSuccess(data as Pin);
  };

  if (isReverseGeocoding) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What's this place called?"
      />

      {/* Address */}
      <Input
        label="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address"
      />

      {/* List Selection */}
      <div>
        <label className="block text-sm text-text-secondary mb-2">
          Add to list
        </label>
        <div className="flex flex-wrap gap-2">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => setSelectedListId(list.id)}
              className={`px-3 py-2 rounded-[--radius-md] text-sm flex items-center gap-2 transition-all ${
                selectedListId === list.id
                  ? "bg-primary text-white shadow-md"
                  : "bg-surface-elevated text-text-primary border border-border hover:border-primary/50"
              }`}
            >
              <span>{list.emoji_icon}</span>
              <span>{list.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status Toggle */}
      <div>
        <label className="block text-sm text-text-secondary mb-2">
          Status
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setIsVisited(false)}
            className={`flex-1 px-4 py-2.5 rounded-[--radius-md] text-sm font-medium transition-all ${
              !isVisited
                ? "bg-status-want/20 text-status-want border-2 border-status-want"
                : "bg-surface-elevated text-text-secondary border-2 border-transparent"
            }`}
          >
            Want to try
          </button>
          <button
            onClick={() => setIsVisited(true)}
            className={`flex-1 px-4 py-2.5 rounded-[--radius-md] text-sm font-medium transition-all ${
              isVisited
                ? "bg-status-visited/20 text-status-visited border-2 border-status-visited"
                : "bg-surface-elevated text-text-secondary border-2 border-transparent"
            }`}
          >
            Been here
          </button>
        </div>
      </div>

      {/* Rating (only if visited) */}
      {isVisited && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <label className="block text-sm text-text-secondary mb-2">
            Rating
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(rating === star ? null : star)}
                className={`text-2xl transition-all ${
                  rating && star <= rating
                    ? "text-status-rating scale-110"
                    : "text-text-muted hover:text-status-rating/50"
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm text-text-secondary mb-2">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you love about this place?"
          rows={3}
          className="w-full bg-surface-elevated border border-border rounded-[--radius-md] px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors resize-none"
        />
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
          disabled={!name.trim() || !selectedListId}
        >
          Save Pin
        </Button>
      </div>
    </div>
  );
}
