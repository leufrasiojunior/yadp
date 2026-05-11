import type { ReactNode } from "react";

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Activity, Binary } from "lucide-react";

import { BetaDisclaimerDialog } from "@/app/(main)/_components/beta-disclaimer-dialog";
import { NotificationBell } from "@/app/(main)/_components/notification-bell";
import { ShellActionsMenu } from "@/app/(main)/_components/shell-actions-menu";
import { DashboardScopeSelector } from "@/app/(main)/dashboard/_components/dashboard-scope-selector";
import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar";
import { LayoutControls } from "@/app/(main)/dashboard/_components/sidebar/layout-controls";
import { SearchDialog } from "@/app/(main)/dashboard/_components/sidebar/search-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ApiErrorScreen } from "@/components/yapd/api-error-screen";
import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { AppSessionProvider } from "@/components/yapd/app-session-provider";
import {
  getInstances,
  getNavigationSummary,
  getNotificationsPreview,
  getServerSession,
  getSetupStatus,
  isYapdApiResponseError,
  isYapdApiUnavailableError,
} from "@/lib/api/yapd-server";
import {
  DASHBOARD_SCOPE_COOKIE,
  parseDashboardScope,
  resolveDashboardScope,
  serializeDashboardScope,
} from "@/lib/dashboard/dashboard-scope";
import { getServerI18n } from "@/lib/i18n/server";
import { SIDEBAR_COLLAPSIBLE_VALUES, SIDEBAR_VARIANT_VALUES } from "@/lib/preferences/layout";
import { cn } from "@/lib/utils";
import { getPreference } from "@/server/server-actions";
import { NavigationSummaryProvider } from "@/stores/navigation-summary/navigation-summary-provider";
import { NotificationsProvider } from "@/stores/notifications/notifications-provider";

export default async function MainLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { locale, messages } = await getServerI18n();

  try {
    const [setup, session, instances, cookieStore, variant, collapsible, navigationSummary, notificationsPreview] =
      await Promise.all([
        getSetupStatus(),
        getServerSession(),
        getInstances(),
        cookies(),
        getPreference("sidebar_variant", SIDEBAR_VARIANT_VALUES, "inset"),
        getPreference("sidebar_collapsible", SIDEBAR_COLLAPSIBLE_VALUES, "icon"),
        getNavigationSummary().catch(() => null),
        getNotificationsPreview().catch(() => null),
      ]);

    if (setup.needsSetup) {
      redirect("/setup");
    }

    if (!session) {
      redirect("/login");
    }

    const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
    const selectedDashboardScope = serializeDashboardScope(
      resolveDashboardScope(parseDashboardScope(cookieStore.get(DASHBOARD_SCOPE_COOKIE)?.value), instances.items),
    );

    return (
      <AppSessionProvider session={session}>
        <NotificationsProvider initialPreview={notificationsPreview}>
          <NavigationSummaryProvider initialSummary={navigationSummary}>
            <SidebarProvider
              defaultOpen={defaultOpen}
              style={
                {
                  "--sidebar-width": "calc(var(--spacing) * 68)",
                } as React.CSSProperties
              }
            >
              <AppSidebar session={session} variant={variant} collapsible={collapsible} />
              <SidebarInset
                className={cn(
                  "[html[data-content-layout=centered]_&>*]:mx-auto",
                  "[html[data-content-layout=centered]_&>*]:w-full",
                  "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
                )}
              >
                <header
                  className={cn(
                    "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear",
                    "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
                  )}
                >
                  <div className="flex w-full min-w-0 items-center gap-1 px-2 sm:px-3 lg:gap-2 lg:px-6">
                    <div className="flex min-w-0 shrink-0 items-center gap-1 lg:gap-2">
                      <SidebarTrigger className="lg:-ml-1 shrink-0" />
                      <Separator
                        orientation="vertical"
                        className="mx-2 hidden data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center lg:block"
                      />
                      <SearchDialog />
                      <BetaDisclaimerDialog className="hidden lg:inline-flex" />
                    </div>
                    <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
                      <DashboardScopeSelector
                        allInstancesLabel={messages.dashboard.scope.allInstances}
                        instances={instances.items}
                        label={messages.dashboard.scope.label}
                        placeholder={messages.dashboard.scope.placeholder}
                        value={selectedDashboardScope}
                      />
                      <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
                        <Link prefetch={false} href="/overview">
                          <Activity />
                          {messages.layout.overviewButton}
                        </Link>
                      </Button>
                      <Button asChild size="sm" className="hidden lg:inline-flex">
                        <Link prefetch={false} href="/instances">
                          <Binary />
                          {messages.layout.instancesButton}
                        </Link>
                      </Button>
                      <NotificationBell />
                      <LayoutControls />
                      <ShellActionsMenu
                        actionsLabel={messages.layout.actionsMenuLabel}
                        className="lg:hidden"
                        instancesLabel={messages.layout.instancesButton}
                        overviewLabel={messages.layout.overviewButton}
                      />
                    </div>
                  </div>
                </header>
                <div className="h-full p-2 sm:p-4 lg:p-6">{children}</div>
              </SidebarInset>
            </SidebarProvider>
          </NavigationSummaryProvider>
        </NotificationsProvider>
      </AppSessionProvider>
    );
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen locale={locale} retryHref="/dashboard" />;
    }

    if (isYapdApiResponseError(error)) {
      return (
        <ApiErrorScreen
          apiBaseUrl={error.baseUrl}
          locale={locale}
          message={error.message}
          retryHref="/dashboard"
          status={error.status}
        />
      );
    }

    throw error;
  }
}
