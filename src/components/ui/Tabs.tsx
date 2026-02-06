"use client";

import { motion } from "framer-motion";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  variant?: "pill" | "underline";
  className?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  variant = "pill",
  className = "",
}: TabsProps) {
  if (variant === "underline") {
    return (
      <div className={`flex border-b border-border ${className}`}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex-1 py-3 text-sm font-medium transition-colors ${
                isActive ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {tab.icon}
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Pill variant (default)
  return (
    <div className={`flex gap-2 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2.5 rounded-[--radius-md] text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              isActive
                ? "bg-surface-elevated text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
