"use client";

import Image from "next/image";
import Link from "next/link";

import { useShallow } from "zustand/react/shallow";

import { BetaDisclaimerDialog } from "@/app/(main)/_components/beta-disclaimer-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { useWebI18n } from "@/lib/i18n/client";
import { getSidebarItems } from "@/navigation/sidebar/sidebar-items";
import { useNavigationSummaryStore } from "@/stores/navigation-summary/navigation-summary-provider";
import { useNotificationsStore } from "@/stores/notifications/notifications-provider";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import logoSrc from "../../../../../../../../media/logo.png";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { SidebarSyncBlocking } from "./sidebar-sync-blocking";

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  session: {
    baseline: {
      name: string;
      baseUrl: string;
    };
  };
};

export function AppSidebar({ session, ...props }: AppSidebarProps) {
  const { messages } = useWebI18n();
  const navigationSummary = useNavigationSummaryStore((state) => state.summary);
  const notificationsPreview = useNotificationsStore((state) => state.preview);
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.sidebarVariant,
      sidebarCollapsible: s.sidebarCollapsible,
      isSynced: s.isSynced,
    })),
  );

  const variant = isSynced ? sidebarVariant : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link prefetch={false} href="/dashboard">
                <Image
                  alt={`${APP_CONFIG.name} logo`}
                  className="h-8 w-8 shrink-0 rounded-lg object-contain"
                  src={logoSrc}
                  width={32}
                  height={32}
                  priority
                />
                <span className="font-semibold text-base">{APP_CONFIG.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={getSidebarItems(messages, navigationSummary, notificationsPreview?.unreadCount)} />
        <SidebarSyncBlocking />
        {/* <NavDocuments items={data.documents} /> */}
        {/* <NavSecondary items={data.navSecondary} className="mt-auto" /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ name: session.baseline.name, email: session.baseline.baseUrl, avatar: "" }} />
        <BetaDisclaimerDialog placement="sidebar" />
      </SidebarFooter>
    </Sidebar>
  );
}
