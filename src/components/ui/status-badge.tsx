import { cn } from "@/lib/utils";
import type { AuthenticityLevel } from "@/types";
import { Shield, ShieldAlert, ShieldQuestion, ShieldCheck } from "lucide-react";

interface StatusBadgeProps {
  status: AuthenticityLevel;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

const statusConfig: Record<AuthenticityLevel, { label: string; icon: typeof Shield; className: string }> = {
  authentic: {
    label: "Authentic",
    icon: ShieldCheck,
    className: "bg-success/15 text-success border-success/25",
  },
  suspicious: {
    label: "Suspicious",
    icon: ShieldAlert,
    className: "bg-warning/15 text-warning border-warning/25",
  },
  manipulated: {
    label: "Manipulated",
    icon: ShieldAlert,
    className: "bg-destructive/15 text-destructive border-destructive/25",
  },
  uncertain: {
    label: "Uncertain",
    icon: ShieldQuestion,
    className: "bg-secondary/15 text-secondary border-secondary/25",
  },
};

const sizeClasses = {
  sm: "text-[10px] px-2 py-0.5 gap-1",
  md: "text-xs px-2.5 py-1 gap-1.5",
  lg: "text-sm px-3 py-1.5 gap-2",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

const StatusBadge = ({ status, size = "md", showIcon = true, className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold transition-colors",
        sizeClasses[size],
        config.className,
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </span>
  );
};

export default StatusBadge;
