"use client";

import { useRouter } from "next/navigation";

interface HeaderProps {
  title: string;
  subtitle?: string;
  backButton?: boolean;
  rightAction?: React.ReactNode;
  className?: string;
}

export function Header({
  title,
  subtitle,
  backButton = false,
  rightAction,
  className = "",
}: HeaderProps) {
  const router = useRouter();

  return (
    <header
      className={`sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border ${className}`}
    >
      <div className="flex items-center gap-3 p-4">
        {backButton && (
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-[--radius-md] bg-surface-elevated flex items-center justify-center hover:bg-surface-hover transition-colors"
          >
            <BackIcon />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-text-primary truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-text-secondary truncate">{subtitle}</p>
          )}
        </div>
        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>
    </header>
  );
}

function BackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
