import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "block w-full h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-muted/70 " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";

// Label + input + hint + error message, wired up for screen readers.
export function Field({
  label,
  name,
  hint,
  errors,
  className,
  trailing,
  prefix,
  suffix,
  inputEnd,
  ...inputProps
}: ComponentProps<"input"> & {
  label: string;
  name: string;
  hint?: ReactNode;
  errors?: string[];
  trailing?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  inputEnd?: ReactNode; // a small button inside the box, on the right (e.g. show password)
}) {
  const id = inputProps.id ?? name;
  const hasError = !!errors?.length;
  const describedBy = [hint ? `${id}-hint` : null, hasError ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {trailing}
      </div>
      <div className={cn(Boolean(prefix || suffix) && "flex items-stretch", Boolean(inputEnd) && "relative")}>
        {prefix && (
          <span className="inline-flex items-center rounded-l-lg border border-r-0 border-line-strong bg-paper px-3 text-sm text-muted">
            {prefix}
          </span>
        )}
        <input
          id={id}
          name={name}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={cn(inputClass, Boolean(prefix) && "rounded-l-none", Boolean(suffix) && "rounded-r-none", Boolean(inputEnd) && "pr-12")}
          {...inputProps}
        />
        {inputEnd && <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{inputEnd}</div>}
        {suffix && (
          <span className="inline-flex items-center rounded-r-lg border border-l-0 border-line-strong bg-paper px-3 text-sm text-muted">
            {suffix}
          </span>
        )}
      </div>
      {hint && !hasError && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
