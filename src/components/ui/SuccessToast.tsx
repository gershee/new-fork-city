"use client";

import { useState, createContext, useContext, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Toast {
  id: string;
  message: string;
  emoji?: string;
  subtext?: string;
  type?: "success" | "info" | "warning";
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Fun toast messages by action type
export const toastMessages = {
  save: [
    { message: "Saved!", emoji: "📌", subtext: "You've got great taste" },
    { message: "Nice pick!", emoji: "✨", subtext: "Added to your list" },
    { message: "Locked in!", emoji: "🔒", subtext: "Spot saved" },
  ],
  firstSave: [
    { message: "First save!", emoji: "🎉", subtext: "Your journey begins" },
    { message: "Welcome!", emoji: "🗺️", subtext: "Your first spot awaits" },
  ],
  hot: [
    { message: "It's getting hot!", emoji: "🔥", subtext: "10+ people saved this" },
    { message: "Viral alert!", emoji: "📈", subtext: "This spot is blowing up" },
  ],
  listCreated: [
    { message: "List created!", emoji: "📋", subtext: "Now go fill it up" },
    { message: "New adventure!", emoji: "🚀", subtext: "List ready to explore" },
  ],
  follow: [
    { message: "Following!", emoji: "👋", subtext: "You'll see their spots now" },
    { message: "Connected!", emoji: "🤝", subtext: "New foodie friend added" },
  ],
  like: [
    { message: "Liked!", emoji: "❤️", subtext: "They'll appreciate it" },
    { message: "Love it!", emoji: "💕", subtext: "Taste approved" },
  ],
  copied: [
    { message: "Copied!", emoji: "📋", subtext: "Ready to share" },
  ],
  error: [
    { message: "Oops!", emoji: "😅", subtext: "Something went wrong" },
  ],
};

export function getRandomToast(type: keyof typeof toastMessages): Omit<Toast, "id"> {
  const messages = toastMessages[type];
  return messages[Math.floor(Math.random() * messages.length)];
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="pointer-events-auto"
    >
      <div
        onClick={onDismiss}
        className="bg-surface-elevated/95 backdrop-blur-xl border border-border rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3 cursor-pointer hover:bg-surface-hover transition-colors min-w-[200px]"
      >
        {toast.emoji && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.1 }}
            className="text-2xl"
          >
            {toast.emoji}
          </motion.span>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary text-sm">{toast.message}</p>
          {toast.subtext && (
            <p className="text-xs text-text-muted truncate">{toast.subtext}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
