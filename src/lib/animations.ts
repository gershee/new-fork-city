/**
 * Shared animation configurations for Framer Motion
 */

// Spring animations
export const springBounce = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 15,
};

export const springGentle = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 25,
};

export const springSnappy = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
};

// Duration-based transitions
export const transitionFast = {
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1] as const,
};

export const transitionBase = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1] as const,
};

export const transitionSlow = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1] as const,
};

// Common animation variants
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

export const slideInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// Stagger children animation
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// Button press animation
export const buttonPress = {
  whileTap: { scale: 0.95 },
  whileHover: { scale: 1.02 },
};

// Pulse animation for attention
export const pulseAnimation = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Glow pulse for hot items
export const glowPulse = {
  animate: {
    boxShadow: [
      '0 0 0 rgba(251, 146, 60, 0)',
      '0 0 20px rgba(251, 146, 60, 0.4)',
      '0 0 0 rgba(251, 146, 60, 0)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};
