"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Checkbox/radio styled as a pill. The native input stays in the form (works
 * without JS) and drives the look through `has-checked`. `color` tints it.
 */
export function Chip({
  name,
  value,
  label,
  type = "checkbox",
  color,
  checked,
  defaultChecked,
  disabled,
  onChange,
}: {
  name: string;
  value: string;
  label: React.ReactNode;
  type?: "checkbox" | "radio";
  color?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label
      style={{ ["--chip" as string]: color ?? "var(--course-primary)" } as CSSProperties}
      className={cn(
        "relative inline-flex cursor-pointer select-none items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-extrabold ring-[1.5px] ring-line-strong ring-inset",
        "hover:bg-canvas active:scale-[0.96]",
        "has-checked:bg-[var(--chip)] has-checked:text-white has-checked:ring-transparent has-checked:hover:brightness-105",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[var(--chip)]",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="sr-only"
      />
      {label}
    </label>
  );
}
