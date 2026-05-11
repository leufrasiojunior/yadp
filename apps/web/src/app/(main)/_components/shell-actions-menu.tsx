"use client";

import Link from "next/link";

import { Activity, Binary, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ShellActionsMenuProps = {
  actionsLabel: string;
  className?: string;
  instancesLabel: string;
  overviewLabel: string;
};

export function ShellActionsMenu({
  actionsLabel,
  className,
  instancesLabel,
  overviewLabel,
}: Readonly<ShellActionsMenuProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("shrink-0", className)}
          aria-label={actionsLabel}
          title={actionsLabel}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/overview">
            <Activity />
            {overviewLabel}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/instances">
            <Binary />
            {instancesLabel}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
