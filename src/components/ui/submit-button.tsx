"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { buttonClass, type ButtonVariant } from "./button";

export function SubmitButton({
  children,
  pendingText = "Salvando…",
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { pendingText?: string; variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      aria-disabled={pending}
      className={buttonClass({ variant, size }, className)}
      {...props}
    >
      {pending ? pendingText : children}
    </button>
  );
}
