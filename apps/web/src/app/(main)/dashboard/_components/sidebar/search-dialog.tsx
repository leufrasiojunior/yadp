"use client";
import * as React from "react";

import { useRouter } from "next/navigation";

import { Activity, Binary, FileText, LayoutDashboard, Search, ShieldCheck, Waypoints } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useWebI18n } from "@/lib/i18n/client";

export function SearchDialog() {
  const router = useRouter();
  const { messages } = useWebI18n();
  const [open, setOpen] = React.useState(false);
  const searchItems = React.useMemo(
    () => [
      {
        group: messages.sidebar.search.group,
        icon: Activity,
        label: messages.layout.overviewButton,
        href: "/overview",
      },
      {
        group: messages.sidebar.search.group,
        icon: LayoutDashboard,
        label: messages.sidebar.items.dashboard,
        href: "/dashboard",
      },
      {
        group: messages.sidebar.search.group,
        icon: FileText,
        label: messages.sidebar.items.queries,
        href: "/queries",
      },
      {
        group: messages.sidebar.search.group,
        icon: Binary,
        label: messages.sidebar.items.instances,
        href: "/instances",
      },
      {
        group: messages.sidebar.search.group,
        icon: Waypoints,
        label: messages.sidebar.items.setupBaseline,
        href: "/setup",
      },
      {
        group: messages.sidebar.search.group,
        icon: ShieldCheck,
        label: messages.sidebar.items.baselineLogin,
        href: "/login",
      },
    ],
    [messages],
  );
  const groups = [...new Set(searchItems.map((item) => item.group))];

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="link"
        className="px-0! font-normal text-muted-foreground hover:no-underline"
      >
        <Search data-icon="inline-start" />
        {messages.sidebar.search.button}
        <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium text-[10px]">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder={messages.sidebar.search.placeholder} />
          <CommandList>
            <CommandEmpty>{messages.sidebar.search.empty}</CommandEmpty>
            {groups.map((group, index) => (
              <React.Fragment key={group}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup heading={group}>
                  {searchItems
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <CommandItem
                        key={item.label}
                        onSelect={() => {
                          setOpen(false);
                          router.push(item.href);
                        }}
                      >
                        {item.icon && <item.icon />}
                        <span>{item.label}</span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
