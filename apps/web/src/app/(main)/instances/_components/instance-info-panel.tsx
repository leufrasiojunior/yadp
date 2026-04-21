"use client";

import { Box, Cpu, HardDrive, Info, Layers3, MonitorCog, Server, Workflow } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InstanceInfoResponse, InstanceVersionComponentInfo } from "@/lib/api/yapd-types";
import type { WebMessages } from "@/lib/i18n/messages";

type InstanceInfoPanelProps = {
  error: string | null;
  info: InstanceInfoResponse | null;
  isLoading: boolean;
  locale: string;
  messages: WebMessages;
  onRetry: () => void;
  formatDateTime: (value: string | Date) => string;
};

function formatNumber(value: number | null, locale: string, maximumFractionDigits = 2) {
  if (value === null) {
    return null;
  }

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
  }).format(value);
}

function formatPercent(value: number | null, locale: string) {
  const formatted = formatNumber(value, locale, 2);
  return formatted ? `${formatted}%` : null;
}

function formatKib(value: number | null, locale: string) {
  if (value === null) {
    return null;
  }

  const gib = value / (1024 * 1024);
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: gib >= 10 ? 1 : 2,
  }).format(gib)} GiB`;
}

function formatUptime(value: number | null, locale: string) {
  if (value === null) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.floor(value));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${new Intl.NumberFormat(locale).format(days)}d`);
  }

  if (hours > 0 || days > 0) {
    parts.push(`${new Intl.NumberFormat(locale).format(hours)}h`);
  }

  parts.push(`${new Intl.NumberFormat(locale).format(minutes)}m`);
  return parts.join(" ");
}

function formatNumberArray(values: number[] | null, locale: string) {
  if (!values || values.length === 0) {
    return null;
  }

  return values.map((value) => formatNumber(value, locale, 2) ?? "0").join(" / ");
}

function ValueRow({
  label,
  value,
  fallback,
}: Readonly<{
  label: string;
  value: string | null;
  fallback: string;
}>) {
  return (
    <div className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className="min-w-0 break-words font-medium text-sm">{value ?? fallback}</p>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
}: Readonly<{
  icon: typeof Server;
  title: string;
}>) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span>{title}</span>
    </div>
  );
}

function VersionBlock({
  label,
  component,
  messages,
}: Readonly<{
  label: string;
  component: InstanceVersionComponentInfo;
  messages: WebMessages;
}>) {
  const local = component?.local;
  const remote = component?.remote;

  return (
    <div className="rounded-lg border border-border/70 p-3">
      <p className="font-medium text-sm">{label}</p>
      <div className="mt-3 space-y-2">
        <ValueRow
          label={messages.forms.instances.info.local}
          value={local ? [local.version, local.branch, local.hash].filter(Boolean).join(" · ") || null : null}
          fallback={messages.forms.instances.info.unavailable}
        />
        <ValueRow
          label={messages.forms.instances.info.remote}
          value={remote ? [remote.version, remote.branch, remote.hash].filter(Boolean).join(" · ") || null : null}
          fallback={messages.forms.instances.info.unavailable}
        />
        {local?.date ? (
          <ValueRow
            label={messages.forms.instances.info.buildDate}
            value={local.date}
            fallback={messages.forms.instances.info.unavailable}
          />
        ) : null}
      </div>
    </div>
  );
}

export function InstanceInfoPanel({
  error,
  info,
  isLoading,
  locale,
  messages,
  onRetry,
  formatDateTime,
}: Readonly<InstanceInfoPanelProps>) {
  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="flex-shrink-0">
        <AlertTitle>{messages.forms.instances.info.errorTitle}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {messages.forms.instances.info.retry}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!info) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="grid flex-shrink-0 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-muted-foreground" />
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              {messages.forms.instances.info.summary}
            </p>
          </div>
          <p className="mt-2 font-medium text-base">
            {info.version.summary || messages.forms.instances.info.unavailable}
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <Workflow className="size-4 text-muted-foreground" />
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              {messages.forms.instances.info.fetchedAt}
            </p>
          </div>
          <p className="mt-2 font-medium text-base">{formatDateTime(info.fetchedAt)}</p>
        </div>
      </div>

      <Tabs defaultValue="version" className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="-mx-1 sticky top-0 z-10 flex-shrink-0 bg-popover/95 px-1 pb-1 backdrop-blur supports-backdrop-filter:backdrop-blur-sm">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="version">
              <Layers3 />
              {messages.forms.instances.info.versionTab}
            </TabsTrigger>
            <TabsTrigger value="host">
              <Server />
              {messages.forms.instances.info.hostTab}
            </TabsTrigger>
            <TabsTrigger value="system">
              <Cpu />
              {messages.forms.instances.info.systemTab}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="version" className="mt-0 min-h-0 flex-1 overflow-y-auto pr-1">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>
                <SectionHeading icon={Layers3} title={messages.forms.instances.info.versionTitle} />
              </CardTitle>
              <CardDescription>{messages.forms.instances.info.versionDescription}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 xl:grid-cols-2">
              <VersionBlock
                label={messages.forms.instances.info.core}
                component={info.version.core}
                messages={messages}
              />
              <VersionBlock
                label={messages.forms.instances.info.web}
                component={info.version.web}
                messages={messages}
              />
              <VersionBlock
                label={messages.forms.instances.info.ftl}
                component={info.version.ftl}
                messages={messages}
              />
              <VersionBlock
                label={messages.forms.instances.info.docker}
                component={info.version.docker}
                messages={messages}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="host" className="mt-0 min-h-0 flex-1 overflow-y-auto pr-1">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>
                <SectionHeading icon={Server} title={messages.forms.instances.info.hostTitle} />
              </CardTitle>
              <CardDescription>{messages.forms.instances.info.hostDescription}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <ValueRow
                  label={messages.forms.instances.info.model}
                  value={info.host.model}
                  fallback={messages.forms.instances.info.unavailable}
                />
                <ValueRow
                  label={messages.forms.instances.info.nodename}
                  value={info.host.nodename}
                  fallback={messages.forms.instances.info.unavailable}
                />
                <ValueRow
                  label={messages.forms.instances.info.machine}
                  value={info.host.machine}
                  fallback={messages.forms.instances.info.unavailable}
                />
                <ValueRow
                  label={messages.forms.instances.info.sysname}
                  value={info.host.sysname}
                  fallback={messages.forms.instances.info.unavailable}
                />
              </div>
              <div className="space-y-3">
                <ValueRow
                  label={messages.forms.instances.info.release}
                  value={info.host.release}
                  fallback={messages.forms.instances.info.unavailable}
                />
                <ValueRow
                  label={messages.forms.instances.info.kernelVersion}
                  value={info.host.version}
                  fallback={messages.forms.instances.info.unavailable}
                />
                <ValueRow
                  label={messages.forms.instances.info.domainname}
                  value={info.host.domainname}
                  fallback={messages.forms.instances.info.unavailable}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-0 min-h-0 flex-1 overflow-y-auto pr-1">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>
                <SectionHeading icon={MonitorCog} title={messages.forms.instances.info.systemTitle} />
              </CardTitle>
              <CardDescription>{messages.forms.instances.info.systemDescription}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <ValueRow
                  label={messages.forms.instances.info.uptime}
                  value={formatUptime(info.system.uptime, locale)}
                  fallback={messages.forms.instances.info.unavailable}
                />
                <ValueRow
                  label={messages.forms.instances.info.processes}
                  value={formatNumber(info.system.procs, locale, 0)}
                  fallback={messages.forms.instances.info.unavailable}
                />
                <ValueRow
                  label={messages.forms.instances.info.cpuCores}
                  value={formatNumber(info.system.cpu?.nprocs ?? null, locale, 0)}
                  fallback={messages.forms.instances.info.unavailable}
                />
                <ValueRow
                  label={messages.forms.instances.info.cpuUsage}
                  value={formatPercent(info.system.cpu?.percentCpu ?? null, locale)}
                  fallback={messages.forms.instances.info.unavailable}
                />
                <ValueRow
                  label={messages.forms.instances.info.cpuLoadRaw}
                  value={formatNumberArray(info.system.cpu?.load?.raw ?? null, locale)}
                  fallback={messages.forms.instances.info.unavailable}
                />
                <ValueRow
                  label={messages.forms.instances.info.cpuLoadPercent}
                  value={formatNumberArray(info.system.cpu?.load?.percent ?? null, locale)}
                  fallback={messages.forms.instances.info.unavailable}
                />
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-border/70 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <HardDrive className="size-4 text-muted-foreground" />
                    <p className="font-medium text-sm">{messages.forms.instances.info.memoryTitle}</p>
                  </div>
                  <div className="space-y-3">
                    <ValueRow
                      label={messages.forms.instances.info.ram}
                      value={
                        info.system.memory.ram
                          ? `${formatKib(info.system.memory.ram.used, locale) ?? messages.forms.instances.info.unavailable} / ${
                              formatKib(info.system.memory.ram.total, locale) ??
                              messages.forms.instances.info.unavailable
                            }`
                          : null
                      }
                      fallback={messages.forms.instances.info.unavailable}
                    />
                    <ValueRow
                      label={messages.forms.instances.info.swap}
                      value={
                        info.system.memory.swap
                          ? `${formatKib(info.system.memory.swap.used, locale) ?? messages.forms.instances.info.unavailable} / ${
                              formatKib(info.system.memory.swap.total, locale) ??
                              messages.forms.instances.info.unavailable
                            }`
                          : null
                      }
                      fallback={messages.forms.instances.info.unavailable}
                    />
                    <ValueRow
                      label={messages.forms.instances.info.percentUsed}
                      value={formatPercent(info.system.memory.ram?.percentUsed ?? null, locale)}
                      fallback={messages.forms.instances.info.unavailable}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <Box className="size-4 text-muted-foreground" />
                    <p className="font-medium text-sm">{messages.forms.instances.info.ftlTitle}</p>
                  </div>
                  <div className="space-y-3">
                    <ValueRow
                      label={messages.forms.instances.info.ftlMemory}
                      value={formatPercent(info.system.ftl?.percentMem ?? null, locale)}
                      fallback={messages.forms.instances.info.unavailable}
                    />
                    <ValueRow
                      label={messages.forms.instances.info.ftlCpu}
                      value={formatPercent(info.system.ftl?.percentCpu ?? null, locale)}
                      fallback={messages.forms.instances.info.unavailable}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
