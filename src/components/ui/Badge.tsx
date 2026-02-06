"use client";

interface BadgeProps {
  variant?: "default" | "visited" | "want" | "rating" | "primary" | "accent";
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
}

const variantClasses = {
  default: "bg-surface text-text-secondary",
  visited: "bg-[--status-visited-bg] text-status-visited",
  want: "bg-[--status-want-bg] text-status-want",
  rating: "bg-[--status-rating-bg] text-status-rating",
  primary: "bg-primary-muted text-primary",
  accent: "bg-accent-muted text-accent",
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

export function Badge({
  variant = "default",
  size = "sm",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  );
}
