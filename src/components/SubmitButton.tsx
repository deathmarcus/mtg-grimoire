"use client";

import { useFormStatus } from "react-dom";

type Variant = "primary" | "surface" | "danger";

export function SubmitButton({
  children,
  pendingLabel = "Working…",
  variant = "primary",
  className = "",
  fullWidth = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  className?: string;
  fullWidth?: boolean;
}) {
  const { pending } = useFormStatus();

  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "danger"
        ? ""
        : "btn-ghost";

  const dangerStyle =
    variant === "danger"
      ? { color: "var(--neg)", borderColor: "var(--neg)" }
      : undefined;

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={[
        "btn",
        variantClass,
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...dangerStyle,
        opacity: pending ? 0.6 : undefined,
        justifyContent: fullWidth ? "center" : undefined,
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
