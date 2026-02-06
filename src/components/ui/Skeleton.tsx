"use client";

import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className = "",
  variant = "text",
  width,
  height,
}: SkeletonProps) {
  const baseClass = "skeleton bg-surface-elevated";

  const variantClasses = {
    text: "rounded-md h-4",
    circular: "rounded-full",
    rectangular: "rounded-xl",
  };

  const style = {
    width: width,
    height: height,
  };

  return (
    <div
      className={`${baseClass} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

// Pre-built skeleton patterns
export function CardSkeleton() {
  return (
    <div className="bg-surface-elevated rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton variant="rectangular" className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={16} />
          <Skeleton width="80%" height={12} />
        </div>
      </div>
      <Skeleton width="40%" height={12} />
    </div>
  );
}

export function ListCardSkeleton() {
  return (
    <div className="bg-surface-elevated rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="rectangular" className="w-10 h-10" />
        <div className="flex-1 space-y-2">
          <Skeleton width="50%" height={14} />
          <Skeleton width="30%" height={10} />
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton variant="circular" className="w-20 h-20" />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={20} />
          <Skeleton width="40%" height={14} />
          <Skeleton width="80%" height={12} />
        </div>
      </div>
      <div className="flex gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="text-center space-y-1">
            <Skeleton variant="rectangular" className="w-12 h-6 mx-auto" />
            <Skeleton width={40} height={10} className="mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PinDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton variant="rectangular" className="w-full h-12" />
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="w-10 h-10" />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={10} />
        </div>
      </div>
      <Skeleton width="100%" height={16} />
      <div className="flex gap-2">
        <Skeleton variant="rectangular" className="w-20 h-8" />
        <Skeleton variant="rectangular" className="w-20 h-8" />
      </div>
    </div>
  );
}

// Animated shimmer wrapper for any content
export function ShimmerWrapper({ children, isLoading, className = "" }: {
  children: React.ReactNode;
  isLoading: boolean;
  className?: string;
}) {
  if (!isLoading) return <>{children}</>;

  return (
    <div className={`relative ${className}`}>
      <div className="opacity-50">{children}</div>
      <motion.div
        className="absolute inset-0 pointer-events-none"
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
    </div>
  );
}
