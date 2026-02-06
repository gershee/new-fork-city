"use client";

import { forwardRef } from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  variant?: "default" | "elevated" | "interactive";
  padding?: "none" | "sm" | "md" | "lg";
  children: React.ReactNode;
}

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const variantClasses = {
  default: "bg-surface rounded-[--radius-lg]",
  elevated: "bg-surface-elevated rounded-[--radius-lg]",
  interactive: "bg-surface-elevated rounded-[--radius-lg] cursor-pointer hover:bg-surface-hover transition-colors",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "elevated", padding = "md", className = "", children, onClick, ...props }, ref) => {
    const baseClasses = `${variantClasses[variant]} ${paddingClasses[padding]} ${className}`;

    if (variant === "interactive" || onClick) {
      return (
        <motion.div
          ref={ref}
          className={baseClasses}
          onClick={onClick}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.1 }}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref as React.Ref<HTMLDivElement>} className={baseClasses} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
