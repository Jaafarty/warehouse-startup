"use client";

import * as React from "react";

type MobileNavCtx = { open: boolean; setOpen: (v: boolean) => void };

const Ctx = React.createContext<MobileNavCtx | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo(() => ({ open, setOpen }), [open]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Safe fallback so consumers outside a store (no provider edge cases) don't crash.
export function useMobileNav(): MobileNavCtx {
  return React.useContext(Ctx) ?? { open: false, setOpen: () => {} };
}
