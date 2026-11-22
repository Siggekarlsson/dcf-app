"use client";

import { createContext, useContext, type ReactNode } from "react";

interface FlashState {
  keys: ReadonlySet<string>;
  /** Ökar vid varje omräkning så att animationen startar om. */
  id: number;
}

const FlashContext = createContext<FlashState>({ keys: new Set(), id: 0 });

export const FlashProvider = FlashContext.Provider;

/** Visar innehållet och markerar det kort om `flashKey` ändrades vid senaste omräkningen. */
export function Flash({ flashKey, children, className = "" }: { flashKey: string; children: ReactNode; className?: string }) {
  const { keys, id } = useContext(FlashContext);
  const on = keys.has(flashKey);
  return (
    <span key={on ? `f${id}` : "s"} className={`${on ? "flash" : ""} -mx-1 px-1 ${className}`}>
      {children}
    </span>
  );
}
