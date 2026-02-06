"use client";

import { motion } from "framer-motion";

interface ListItemProps {
  emoji?: string;
  color?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  rightElement?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ListItem({
  emoji,
  color = "#f04e8c",
  title,
  subtitle,
  meta,
  rightElement,
  onClick,
  className = "",
}: ListItemProps) {
  const content = (
    <>
      {emoji && (
        <div
          className="w-10 h-10 rounded-[--radius-md] flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <span className="text-lg">{emoji}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text-primary truncate">{title}</p>
        {subtitle && (
          <p className="text-sm text-text-secondary truncate">{subtitle}</p>
        )}
        {meta && (
          <p className="text-xs text-text-muted truncate mt-0.5">{meta}</p>
        )}
      </div>
      {rightElement && <div className="shrink-0">{rightElement}</div>}
    </>
  );

  if (onClick) {
    return (
      <motion.button
        onClick={onClick}
        className={`w-full flex items-center gap-3 p-3 bg-surface-elevated rounded-[--radius-md] hover:bg-surface-hover transition-colors text-left ${className}`}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.1 }}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 bg-surface-elevated rounded-[--radius-md] ${className}`}
    >
      {content}
    </div>
  );
}
