import { Activity, Binary, LayoutDashboard, type LucideIcon, ShieldCheck, Waypoints } from "lucide-react";

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

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Instances",
        url: "/instances",
        icon: Binary,
      },
    ],
  },
  {
    id: 2,
    label: "Operations",
    items: [
      {
        title: "Baseline Login",
        url: "/login",
        icon: ShieldCheck,
        newTab: true,
      },
      {
        title: "Setup Baseline",
        url: "/setup",
        icon: Waypoints,
        newTab: true,
      },
    ],
  },
  {
    id: 3,
    label: "Status",
    items: [
      {
        title: "API Health",
        url: "/dashboard",
        icon: Activity,
      },
    ],
  },
];
