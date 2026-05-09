import { cn } from "@/lib/utils";
import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-coral text-white shadow-[0_10px_30px_-10px_rgba(232,93,93,0.65)] hover:bg-coral-600 hover:scale-[1.02] hover:shadow-[0_14px_40px_-10px_rgba(232,93,93,0.75)] active:scale-[0.98]",
  secondary:
    "bg-white/80 text-warm-brown border border-rose-300/60 backdrop-blur-md hover:bg-white hover:border-coral/50",
  outline:
    "bg-transparent text-warm-brown border border-warm-brown/20 hover:bg-warm-brown/5 hover:border-warm-brown/40",
  ghost: "text-warm-brown hover:bg-warm-brown/5",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-2 text-sm rounded-full",
  md: "px-6 py-3 text-sm rounded-full",
  lg: "px-8 py-4 text-base rounded-full",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
