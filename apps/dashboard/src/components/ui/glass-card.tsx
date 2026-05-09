import { cn } from "@/lib/utils";
import * as React from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: "soft" | "medium" | "strong";
}

export function GlassCard({
  className,
  intensity = "medium",
  ...props
}: GlassCardProps) {
  const intensityClasses = {
    soft: "bg-white/50 backdrop-blur-md",
    medium: "bg-white/65 backdrop-blur-xl",
    strong: "bg-white/80 backdrop-blur-2xl",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/50",
        intensityClasses[intensity],
        "shadow-[0_20px_60px_-20px_rgba(232,93,93,0.18)]",
        className
      )}
      {...props}
    />
  );
}
