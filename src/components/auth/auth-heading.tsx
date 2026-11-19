import type { ReactNode } from "react";

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
      {children && <p className="text-[15px] text-muted">{children}</p>}
    </div>
  );
}
