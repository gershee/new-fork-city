"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FireParticles } from "@/components/effects";
import { AnimatedCounter, AnimatedProgress } from "./AnimatedCounter";

interface HotSpot {
  id: string;
  name: string;
  emoji: string;
  saveCount: number;
  viralPercent: number;
}

interface HotBannerProps {
  spots: HotSpot[];
  onSpotClick?: (spotId: string) => void;
}

export function HotBanner({ spots, onSpotClick }: HotBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || spots.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % spots.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [spots.length, isPaused]);

  if (spots.length === 0) return null;

  const currentSpot = spots[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/20 via-neon-pink/20 to-purple-500/20 border border-orange-500/30"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            "linear-gradient(45deg, rgba(251,146,60,0.3), rgba(240,78,140,0.3))",
            "linear-gradient(135deg, rgba(240,78,140,0.3), rgba(251,146,60,0.3))",
            "linear-gradient(225deg, rgba(251,146,60,0.3), rgba(240,78,140,0.3))",
            "linear-gradient(315deg, rgba(240,78,140,0.3), rgba(251,146,60,0.3))",
            "linear-gradient(45deg, rgba(251,146,60,0.3), rgba(240,78,140,0.3))",
          ],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Fire particles */}
      <FireParticles count={4} />

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              className="text-lg"
            >
              🔥
            </motion.span>
            <span className="text-sm font-bold text-orange-400 uppercase tracking-wide">
              Hot Right Now
            </span>
          </div>

          {/* Dots indicator */}
          {spots.length > 1 && (
            <div className="flex gap-1">
              {spots.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex
                      ? "bg-orange-400 w-4"
                      : "bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Current spot */}
        <AnimatePresence mode="wait">
          <motion.button
            key={currentSpot.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            onClick={() => onSpotClick?.(currentSpot.id)}
            className="w-full text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">
                {currentSpot.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">
                  {currentSpot.name}
                </h3>
                <p className="text-sm text-white/70">
                  <AnimatedCounter value={currentSpot.saveCount} /> people saved this today!
                </p>
              </div>
            </div>

            {/* Viral meter */}
            <div className="flex items-center gap-2">
              <AnimatedProgress value={currentSpot.viralPercent} className="flex-1" />
              <span className="text-sm font-medium text-orange-400">
                {currentSpot.viralPercent}% 🔥
              </span>
            </div>
          </motion.button>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
