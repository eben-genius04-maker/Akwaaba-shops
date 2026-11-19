import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/ui/field";

function FieldShell({ id, label, hint, errors, children, className, optional }: {
  id: string; label: string; hint?: ReactNode; errors?: string[]; children: ReactNode; className?: string; optional?: boolean;
}) {
  const hasError = !!errors?.length;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {hint && !hasError && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {hasError && <p id={`${id}-error`} className="text-xs font-medium text-danger">{errors![0]}</p>}
    </div>
  );
}

const describedBy = (id: string, hint?: ReactNode, errors?: string[]) =>
  [hint ? `${id}-hint` : null, errors?.length ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

export function TextareaField({ label, name, hint, errors, optional, className, ...props }: ComponentProps<"textarea"> & {
  label: string; name: string; hint?: ReactNode; errors?: string[]; optional?: boolean;
}) {
  const id = props.id ?? name;
  return (
    <FieldShell id={id} label={label} hint={hint} errors={errors} optional={optional} className={className}>
      <textarea
        id={id}
        name={name}
        rows={4}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(id, hint, errors)}
        className={cn(inputClass, "h-auto min-h-24 py-2.5 leading-relaxed")}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({ label, name, hint, errors, optional, className, children, ...props }: ComponentProps<"select"> & {
  label: string; name: string; hint?: ReactNode; errors?: string[]; optional?: boolean;
}) {
  const id = props.id ?? name;
  return (
    <FieldShell id={id} label={label} hint={hint} errors={errors} optional={optional} className={className}>
      <select
        id={id}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(id, hint, errors)}
        className={cn(inputClass, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%236d645a%22><path d=%22M5.5 7.5 10 12l4.5-4.5%22 stroke=%22%236d645a%22 stroke-width=%221.6%22 fill=%22none%22/></svg>')] bg-[length:20px] bg-[right_10px_center] bg-no-repeat pr-10")}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

// On/off switch backed by a real checkbox (submits "on" when checked)
export function Toggle({ name, label, description, defaultChecked, checked, onCheckedChange, disabled, form }: {
  name: string; label: string; description?: ReactNode; defaultChecked?: boolean; disabled?: boolean;
  checked?: boolean; onCheckedChange?: (checked: boolean) => void;
  form?: string; // id of a form elsewhere on the page this switch belongs to
}) {
  return (
    <label className="flex cursor-pointer items-start has-[:disabled]:cursor-not-allowed justify-between gap-4 py-1">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          name={name}
          form={form}
          {...(checked !== undefined ? { checked } : { defaultChecked })}
          onChange={onCheckedChange ? (e) => onCheckedChange(e.target.checked) : undefined}
          disabled={disabled}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-line-strong transition-colors peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:opacity-50" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
