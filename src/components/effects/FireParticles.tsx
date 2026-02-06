"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface FireParticlesProps {
  count?: number;
  className?: string;
}

// Pre-generate random values based on index for deterministic rendering
const getParticleConfig = (index: number, seed: number = 0) => {
  // Use sine/cosine for pseudo-random but deterministic values
  const val1 = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  const val2 = Math.cos(index * 78.233 + seed * 12.9898) * 43758.5453;
  const rand1 = val1 - Math.floor(val1);
  const rand2 = val2 - Math.floor(val2);

  return {
    initialX: 30 + rand1 * 40,
    animateX: 20 + rand2 * 60,
    duration: 2 + rand1,
  };
};

export function FireParticles({ count = 5, className = "" }: FireParticlesProps) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      index: i,
      config: getParticleConfig(i, 1),
    })),
    [count]
  );

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map(({ index, config }) => (
        <motion.div
          key={index}
          className="absolute"
          initial={{
            opacity: 0,
            scale: 0,
            x: `${config.initialX}%`,
            y: "100%",
          }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0.5, 1, 0.8, 0],
            y: ["100%", "0%"],
            x: `${config.animateX}%`,
          }}
          transition={{
            duration: config.duration,
            repeat: Infinity,
            delay: index * 0.3,
            ease: "easeOut",
          }}
        >
          <span className="text-lg">🔥</span>
        </motion.div>
      ))}
    </div>
  );
}

// Shimmer effect component
export function ShimmerEffect({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
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
  );
}

// Pulsing glow ring for hot items
export function HotGlowRing({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`absolute inset-0 rounded-full pointer-events-none ${className}`}
      style={{
        boxShadow: "0 0 0 rgba(251, 146, 60, 0)",
      }}
      animate={{
        boxShadow: [
          "0 0 0 0px rgba(251, 146, 60, 0.4)",
          "0 0 0 8px rgba(251, 146, 60, 0)",
        ],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeOut",
      }}
    />
  );
}

// Rising particles for trending items
export function RisingParticles({ count = 3 }: { count?: number }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      index: i,
      config: getParticleConfig(i, 2),
    })),
    [count]
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(({ index, config }) => (
        <motion.div
          key={index}
          className="absolute text-xs"
          initial={{
            opacity: 0,
            scale: 0,
            x: `${config.initialX}%`,
            y: "100%",
          }}
          animate={{
            opacity: [0, 0.8, 0],
            scale: [0.5, 1, 0.5],
            y: ["100%", "-20%"],
          }}
          transition={{
            duration: config.duration + 0.5,
            repeat: Infinity,
            delay: index * 0.5,
            ease: "easeOut",
          }}
        >
          ↑
        </motion.div>
      ))}
    </div>
  );
}
