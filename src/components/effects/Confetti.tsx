"use client";

import confetti from "canvas-confetti";
import { triggerCelebrationHaptic } from "@/lib/haptics";

type ConfettiType = "save" | "hot" | "list" | "follow" | "milestone";

const confettiConfigs: Record<ConfettiType, confetti.Options> = {
  save: {
    particleCount: 30,
    spread: 60,
    origin: { y: 0.7 },
    colors: ["#f04e8c", "#2dd4bf", "#a78bfa"],
  },
  hot: {
    particleCount: 30,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#fb923c", "#f04e8c", "#fbbf24"],
    shapes: ["circle"],
  },
  list: {
    particleCount: 30,
    spread: 55,
    origin: { y: 0.65 },
    colors: ["#2dd4bf", "#34d399", "#a78bfa"],
  },
  follow: {
    particleCount: 30,
    spread: 50,
    origin: { y: 0.7 },
    colors: ["#f04e8c", "#a78bfa", "#60a5fa"],
  },
  milestone: {
    particleCount: 100,
    spread: 100,
    origin: { y: 0.5 },
    colors: ["#fbbf24", "#fb923c", "#f04e8c", "#a78bfa", "#2dd4bf"],
    shapes: ["circle", "square"],
    ticks: 200,
    gravity: 0.8,
  },
};

// Helper to check if confetti should fire based on milestone
export function shouldFireConfettiForPinCount(pinCount: number): boolean {
  // Fire confetti only on milestones: 1st, 10th, 50th, 100th pin
  return pinCount === 1 || pinCount === 10 || pinCount === 50 || pinCount === 100;
}

export function fireConfetti(type: ConfettiType = "save") {
  const config = confettiConfigs[type];
  triggerCelebrationHaptic();
  confetti(config);
}

// Fire confetti from specific position (for button clicks)
export function fireConfettiFromElement(
  element: HTMLElement,
  type: ConfettiType = "save"
) {
  const rect = element.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  const config = {
    ...confettiConfigs[type],
    origin: { x, y },
  };

  triggerCelebrationHaptic();
  confetti(config);
}

// Fire celebration burst (for major milestones)
export function fireCelebration() {
  const duration = 2000;
  const animationEnd = Date.now() + duration;

  triggerCelebrationHaptic();

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }

    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ["#f04e8c", "#2dd4bf", "#fbbf24"],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ["#f04e8c", "#2dd4bf", "#fbbf24"],
    });
  }, 150);
}

// Fire emoji-style confetti (hearts, stars)
export function fireEmojiConfetti(emoji: string = "❤️") {
  const scalar = 2;
  const emojiShape = confetti.shapeFromText({ text: emoji, scalar });

  triggerCelebrationHaptic();

  confetti({
    shapes: [emojiShape],
    scalar,
    particleCount: 30,
    spread: 60,
    origin: { y: 0.7 },
  });
}
