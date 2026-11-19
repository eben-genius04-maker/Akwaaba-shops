"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Field } from "./field";

// Password box with an eye button to show or hide what's typed
export function PasswordField(props: Omit<ComponentProps<typeof Field>, "type" | "inputEnd">) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      inputEnd={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-ink/5 hover:text-ink"
          aria-label={visible ? `Hide ${props.label.toLowerCase()}` : `Show ${props.label.toLowerCase()}`}
          aria-pressed={visible}
          aria-controls={props.id ?? props.name}
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      }
    />
  );
}
