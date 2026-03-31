"use client";

import { useTransition } from "react";

import { usePathname, useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InstanceItem } from "@/lib/api/yapd-types";
import { setClientCookie } from "@/lib/cookie.client";
import { DASHBOARD_SCOPE_COOKIE } from "@/lib/dashboard/dashboard-scope";

export function DashboardScopeSelector({
  allInstancesLabel,
  instances,
  label,
  placeholder,
  value,
}: Readonly<{
  allInstancesLabel: string;
  instances: InstanceItem[];
  label: string;
  placeholder: string;
  value: string;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleValueChange = (nextValue: string) => {
    setClientCookie(DASHBOARD_SCOPE_COOKIE, nextValue);

    startTransition(() => {
      if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/queries")) {
        router.refresh();
        return;
      }

      router.push("/dashboard");
    });
  };

  return (
    <div>
      <Select disabled={isPending} value={value} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[160px] sm:w-[220px]" size="sm" aria-label={label}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            <SelectLabel>{label}</SelectLabel>
            <SelectItem value="all">{allInstancesLabel}</SelectItem>
            {instances.map((instance) => (
              <SelectItem key={instance.id} value={`instance:${instance.id}`}>
                {instance.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
