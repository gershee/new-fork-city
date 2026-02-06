"use client";

import { motion } from "framer-motion";

interface MapControlsProps {
  mode: "pins" | "heatmap";
  onModeChange: (mode: "pins" | "heatmap") => void;
  onLayersClick: () => void;
  pinCount?: number;
}

export function MapControls({
  mode,
  onModeChange,
  onLayersClick,
  pinCount,
}: MapControlsProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex gap-2">
      {/* Mode Segmented Control */}
      <div className="flex bg-surface/90 backdrop-blur-xl rounded-[--radius-md] p-1 border border-border shadow-lg">
        <button
          onClick={() => onModeChange("pins")}
          className={`relative px-4 py-2 text-sm font-medium rounded-[--radius-sm] transition-colors ${
            mode === "pins" ? "text-white" : "text-text-muted hover:text-text-primary"
          }`}
        >
          {mode === "pins" && (
            <motion.div
              layoutId="mode-indicator"
              className="absolute inset-0 bg-primary rounded-[--radius-sm]"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            <PinsIcon />
            Pins
            {pinCount !== undefined && mode === "pins" && (
              <span className="text-xs opacity-70">({pinCount})</span>
            )}
          </span>
        </button>
        <button
          onClick={() => onModeChange("heatmap")}
          className={`relative px-4 py-2 text-sm font-medium rounded-[--radius-sm] transition-colors ${
            mode === "heatmap" ? "text-white" : "text-text-muted hover:text-text-primary"
          }`}
        >
          {mode === "heatmap" && (
            <motion.div
              layoutId="mode-indicator"
              className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-[--radius-sm]"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            <HeatIcon />
            Heat
          </span>
        </button>
      </div>

      {/* Layers Button */}
      <motion.button
        onClick={onLayersClick}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-4 py-2.5 rounded-[--radius-md] font-medium shadow-lg bg-surface/90 backdrop-blur-xl text-text-primary border border-border hover:bg-surface-hover transition-colors"
      >
        <LayersIcon />
        <span className="text-sm">Layers</span>
      </motion.button>
    </div>
  );
}

function PinsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function HeatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2c.6.7 6 7 6 12a6 6 0 1 1-12 0c0-5 5.4-11.3 6-12z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
