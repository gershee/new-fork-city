"use client";

import { motion } from "framer-motion";

interface HeatmapLegendProps {
  pinCount: number;
}

export function HeatmapLegend({ pinCount }: HeatmapLegendProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute top-20 left-4 z-10 bg-surface/90 backdrop-blur-xl rounded-[--radius-md] p-3 border border-border shadow-lg"
    >
      {/* Info Text */}
      <p className="text-xs text-text-secondary mb-2">
        Showing all public spots
      </p>

      {/* Gradient Legend */}
      <div className="flex items-center gap-1 mb-1">
        <div
          className="h-3 flex-1 rounded-sm"
          style={{
            background: "linear-gradient(to right, rgba(45, 212, 191, 0.8), rgba(240, 78, 140, 0.8), rgba(255, 180, 50, 0.9))"
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-text-muted">
        <span>Low</span>
        <span>High</span>
      </div>

      {/* Pin Count */}
      <p className="text-xs text-text-muted mt-2 pt-2 border-t border-border">
        {pinCount.toLocaleString()} spots
      </p>
    </motion.div>
  );
}
