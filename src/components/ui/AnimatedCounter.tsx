"use client";

import { motion, AnimatePresence } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function AnimatedCounter({ value, className = "", prefix = "", suffix = "" }: AnimatedCounterProps) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      {prefix}
      <span className="relative inline-flex overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{
              y: 15,
              opacity: 0,
            }}
            animate={{
              y: 0,
              opacity: 1,
            }}
            exit={{
              y: -15,
              opacity: 0,
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
            }}
          >
            {value.toLocaleString()}
          </motion.span>
        </AnimatePresence>
      </span>
      {suffix}
    </span>
  );
}

// Animated percentage/progress display
interface AnimatedProgressProps {
  value: number; // 0-100
  className?: string;
  showLabel?: boolean;
}

export function AnimatedProgress({ value, className = "", showLabel = false }: AnimatedProgressProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-neon-cyan via-neon-pink to-orange-400 rounded-full relative"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{
            type: "spring",
            stiffness: 100,
            damping: 20,
          }}
        >
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
            }}
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </motion.div>
      </div>
      {showLabel && (
        <motion.span
          className="text-xs text-text-muted mt-1 block text-right"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {value}%
        </motion.span>
      )}
    </div>
  );
}
