"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

// Pop-up messages that match the light/dark theme
export function ThemedToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.classList.contains("dark") ? "dark" : "light");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return <Toaster position="top-center" richColors closeButton theme={theme} />;
}
