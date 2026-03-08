import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface AnimatedProgressProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning" | "destructive";
  animated?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

const variantClasses = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

const AnimatedProgress = ({
  value,
  max = 100,
  showLabel = false,
  size = "md",
  variant = "default",
  animated = true,
  className,
}: AnimatedProgressProps) => {
  const [displayValue, setDisplayValue] = useState(animated ? 0 : value);
  const percentage = Math.min(Math.max((displayValue / max) * 100, 0), 100);

  useEffect(() => {
    if (!animated) {
      setDisplayValue(value);
      return;
    }

    // Animate from current to target value
    const timer = setTimeout(() => {
      setDisplayValue(value);
    }, 100);

    return () => clearTimeout(timer);
  }, [value, animated]);

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground">Progress</span>
          <span className="text-xs font-bold text-foreground">{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-muted",
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            variantClasses[variant],
            animated && percentage > 0 && "animate-progress-fill"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default AnimatedProgress;
