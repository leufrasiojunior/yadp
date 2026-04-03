import {
  Activity,
  Binary,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  ShieldCheck,
  Users,
  Waypoints,
} from "lucide-react";

import type { WebMessages } from "@/lib/i18n/messages";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export function getSidebarItems(messages: WebMessages): NavGroup[] {
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
          icon: FileText,
        },
        {
          title: messages.sidebar.items.groups,
          url: "/groups",
          icon: Users,
        },
        {
          title: messages.sidebar.items.instances,
          url: "/instances",
          icon: Binary,
        },
      ],
    },
    {
      id: 2,
      label: messages.sidebar.groups.operations,
      items: [
        {
          title: messages.sidebar.items.baselineLogin,
          url: "/login",
          icon: ShieldCheck,
          newTab: true,
        },
        {
          title: messages.sidebar.items.setupBaseline,
          url: "/setup",
          icon: Waypoints,
          newTab: true,
        },
      ],
    },
    {
      id: 3,
      label: messages.sidebar.groups.status,
      items: [
        {
          title: messages.sidebar.items.apiHealth,
          url: "/dashboard",
          icon: Activity,
        },
      ],
    },
  ];
}
