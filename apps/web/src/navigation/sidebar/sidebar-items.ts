import {
  Activity,
  Bell,
  Binary,
  Globe,
  LayoutDashboard,
  List,
  type LucideIcon,
  MonitorSmartphone,
  Waypoints,
} from "lucide-react";

import type { NavigationSummaryResponse } from "@/lib/api/yapd-types";
import type { WebMessages } from "@/lib/i18n/messages";

export type SidebarItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  count?: number;
  isActive?: boolean;
  comingSoon?: boolean;
  newTab?: boolean;
  subItems?: {
    title: string;
    url: string;
    icon?: LucideIcon;
    comingSoon?: boolean;
    newTab?: boolean;
  }[];
};

export type SidebarGroup = {
  id: number;
  label?: string;
  items: SidebarItem[];
};

export type NavMainItem = SidebarItem;

export type NavGroup = SidebarGroup;

export function getSidebarItems(
  messages: WebMessages,
  summary?: NavigationSummaryResponse | null,
  notificationsUnreadCount?: number,
): NavGroup[] {
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
          count: summary?.groups.total,
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
          count: summary?.domains.total,
        },
        {
          title: messages.sidebar.items.lists,
          url: "/lists",
          icon: List,
          count: summary?.lists.total,
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
          title: messages.sidebar.items.notifications,
          url: "/notifications",
          icon: Bell,
          count: notificationsUnreadCount,
        },
      ],
    },
  ];
}
