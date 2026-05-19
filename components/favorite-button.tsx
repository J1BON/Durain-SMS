"use client";

import { Star } from "lucide-react";

type FavoriteButtonProps = {
  active: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
};

export function FavoriteButton({
  active,
  onToggle,
  label,
  disabled,
  size = "sm",
}: FavoriteButtonProps) {
  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      className={`btn btn-ghost btn-square shrink-0 rounded-lg ${dim} ${
        active ? "text-warning" : "text-base-content/35"
      }`}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <Star className={icon} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
