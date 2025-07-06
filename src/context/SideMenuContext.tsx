"use client"

import { createContext, useContext, useState, ReactNode } from "react";

interface SideMenuContextValue {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SideMenuContext = createContext<SideMenuContextValue | undefined>(undefined);

export function SideMenuProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SideMenuContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SideMenuContext.Provider>
  );
}

export function useSideMenu() {
  const context = useContext(SideMenuContext);
  if (!context) {
    throw new Error("useSideMenu must be used within a SideMenuProvider");
  }
  return context;
}
