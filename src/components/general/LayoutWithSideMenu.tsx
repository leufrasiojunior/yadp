"use client"

import { ReactNode } from "react";
import { SideMenuProvider, useSideMenu } from "@/context/SideMenuContext";
import { SideMenu } from "./side-menu";
import { ToggleThemeButton } from "@/components/theme/toggle-theme-button";
import { cn } from "@/lib/utils";

function LayoutContent({ children }: { children: ReactNode }) {
  const { collapsed } = useSideMenu();
  return (
    <div className="flex min-h-screen font-primary font-bold">
      <SideMenu />
      <div className={cn("relative flex-1 transition-[margin] duration-300", collapsed ? "md:ml-14" : "md:ml-64")}>
        <div className="absolute top-4 right-4 z-50">
          <ToggleThemeButton />
        </div>
        <div className="p-9 md:p-10 ">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function LayoutWithSideMenu({ children }: { children: ReactNode }) {
  return (
    <SideMenuProvider>
      <LayoutContent>{children}</LayoutContent>
    </SideMenuProvider>
  );
}
