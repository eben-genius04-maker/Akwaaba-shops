"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { initialFormState, type FormState } from "@/lib/forms";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export function RoleSelect({ storeId, userId, role, disabled, name, action }: {
  storeId: string; userId: string; role: string; disabled?: boolean; name: string;
  action: (s: FormState, fd: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else {
      toast.error(state.message);
      form.current?.reset(); // put the select back
    }
  }, [state]);

  return (
    <form ref={form} action={formAction}>
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>Role for {name}</label>
      <select
        id={`role-${userId}`}
        name="role"
        defaultValue={role}
        disabled={disabled || pending}
        onChange={() => form.current?.requestSubmit()}
        className={cn(inputClass, "h-9 w-32 py-0 text-sm")}
      >
        <option value="owner">Owner</option>
        <option value="manager">Manager</option>
        <option value="staff">Staff</option>
      </select>
    </form>
  );
}
