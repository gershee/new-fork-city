"use client";

import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full bg-surface-elevated border border-border rounded-[--radius-md] px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors ${
              leftIcon ? "pl-10" : ""
            } ${error ? "border-status-error" : ""} ${className}`}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-status-error">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
