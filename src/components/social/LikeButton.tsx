"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { triggerHaptic } from "@/lib/haptics";

interface LikeButtonProps {
  type: "list" | "pin";
  targetId: string;
  initialLiked?: boolean;
  initialCount?: number;
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
  onLikeChange?: (liked: boolean, count: number) => void;
}

export function LikeButton({
  type,
  targetId,
  initialLiked = false,
  initialCount = 0,
  showCount = true,
  size = "md",
  onLikeChange,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsLiked(initialLiked);
    setLikeCount(initialCount);
  }, [initialLiked, initialCount]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;

    setIsLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLoading(false);
      return;
    }

    const table = type === "list" ? "list_likes" : "pin_likes";
    const idColumn = type === "list" ? "list_id" : "pin_id";

    // Optimistic update
    const newLiked = !isLiked;
    const newCount = newLiked ? likeCount + 1 : likeCount - 1;
    setIsLiked(newLiked);
    setLikeCount(newCount);

    if (newLiked) {
      setIsAnimating(true);
      triggerHaptic("medium");
      setTimeout(() => setIsAnimating(false), 500);
    } else {
      triggerHaptic("light");
    }

    try {
      if (newLiked) {
        // Add like
        const { error } = await supabase.from(table).insert({
          user_id: user.id,
          [idColumn]: targetId,
        });

        if (error) {
          // Revert on error
          setIsLiked(!newLiked);
          setLikeCount(likeCount);
          console.error("Error liking:", error);
        }
      } else {
        // Remove like
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("user_id", user.id)
          .eq(idColumn, targetId);

        if (error) {
          // Revert on error
          setIsLiked(!newLiked);
          setLikeCount(likeCount);
          console.error("Error unliking:", error);
        }
      }

      onLikeChange?.(newLiked, newCount);
    } catch (error) {
      // Revert on error
      setIsLiked(!newLiked);
      setLikeCount(likeCount);
      console.error("Error toggling like:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <div className="flex items-center gap-1">
      <motion.button
        onClick={handleLike}
        disabled={isLoading}
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center transition-colors ${
          isLiked
            ? "bg-red-500/20 text-red-500"
            : "bg-surface-elevated text-text-muted hover:text-red-400 hover:bg-red-500/10"
        }`}
        whileTap={{ scale: 0.9 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isLiked ? "liked" : "unliked"}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {isLiked ? (
              <HeartFilledIcon className={iconSizes[size]} />
            ) : (
              <HeartIcon className={iconSizes[size]} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Enhanced burst animation with particles */}
        {isAnimating && (
          <>
            {/* Ring burst */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div className="w-full h-full rounded-full border-2 border-red-500/50" />
            </motion.div>
            {/* Particle burst */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 bg-red-500 rounded-full pointer-events-none"
                style={{
                  left: "50%",
                  top: "50%",
                  marginLeft: -3,
                  marginTop: -3,
                }}
                initial={{ scale: 1, opacity: 1, x: 0, y: 0 }}
                animate={{
                  scale: 0,
                  opacity: 0,
                  x: Math.cos((i * 60 * Math.PI) / 180) * 25,
                  y: Math.sin((i * 60 * Math.PI) / 180) * 25,
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            ))}
          </>
        )}
      </motion.button>

      {showCount && likeCount > 0 && (
        <motion.span
          key={likeCount}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-sm font-medium ${
            isLiked ? "text-red-500" : "text-text-muted"
          }`}
        >
          {likeCount}
        </motion.span>
      )}
    </div>
  );
}

function HeartIcon({ className }: { className?: string }) {
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
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function HeartFilledIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
