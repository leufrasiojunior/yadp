import {
  Activity,
  Binary,
  Globe,
  LayoutDashboard,
  List,
  type LucideIcon,
  MonitorSmartphone,
  Waypoints,
} from "lucide-react";

import type { WebMessages } from "@/lib/i18n/messages";

export type SidebarItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
  items?: {
    title: string;
    url: string;
  }[];
};

export type SidebarGroup = {
  id: number;
  label: string;
  items: SidebarItem[];
};

export function getSidebarItems(messages: WebMessages): SidebarGroup[] {
  return [
    {
      id: 1,
      label: messages.sidebar.groups.overview,
      items: [
        {
          title: messages.sidebar.items.dashboard,
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: messages.sidebar.items.queries,
          url: "/queries",
          icon: Activity,
        },
      ],
    },
    {
      id: 2,
      label: messages.sidebar.groups.operations,
      items: [
        {
          title: messages.sidebar.items.groups,
          url: "/groups",
          icon: Waypoints,
        },
        {
          title: messages.sidebar.items.clients,
          url: "/clients",
          icon: MonitorSmartphone,
        },
        {
          title: messages.sidebar.items.domains,
          url: "/domains",
          icon: Globe,
        },
        {
          title: messages.sidebar.items.lists,
          url: "/lists",
          icon: List,
        },
        {
          title: messages.sidebar.items.instances,
          url: "/instances",
          icon: Binary,
        },
      ],
    },
    {
      id: 3,
      label: messages.sidebar.groups.status,
      items: [
        {
          title: "teste",
          url: "/Teste",
          icon: Activity,
        },
      ],
    },
    {
      id: 4,
      label: messages.sidebar.groups.status,
      items: [
        {
          title: "teste",
          url: "/Teste",
          icon: Activity,
        },
      ],
    },
  ];
}
