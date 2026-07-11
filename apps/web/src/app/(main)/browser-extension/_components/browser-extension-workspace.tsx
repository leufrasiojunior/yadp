"use client";

import { Fragment, useMemo, useState } from "react";

import { ChevronDown, ChevronRight, KeyRound, RefreshCw, Save, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getAuthenticatedBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  BrowserExtensionDeviceRevokeResponse,
  BrowserExtensionDevicesResponse,
  BrowserExtensionDomainDetectionsResponse,
  BrowserExtensionPairingCodeResponse,
  BrowserExtensionSettingsResponse,
} from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type BrowserExtensionWorkspaceProps = Readonly<{
  initialSettings: BrowserExtensionSettingsResponse;
  initialDevices: BrowserExtensionDevicesResponse;
  initialDetections: BrowserExtensionDomainDetectionsResponse;
}>;

type BusyAction = "pairing" | "settings" | "refresh" | `revoke:${string}` | null;

function splitPatterns(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function joinPatterns(value: string[]) {
  return value.join("\n");
}

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusVariant(status: string) {
  if (status === "applied" || status === "active" || status === "blocked") {
    return "default" as const;
  }

  if (status === "partial" || status === "detected") {
    return "secondary" as const;
  }

  if (status === "undone" || status === "revoked" || status === "allowed") {
    return "outline" as const;
  }

  return "destructive" as const;
}

export function BrowserExtensionWorkspace({
  initialDetections,
  initialDevices,
  initialSettings,
}: BrowserExtensionWorkspaceProps) {
  const { csrfToken } = useAppSession();
  const { locale, messages } = useWebI18n();
  const browserExtensionMessages = messages.browserExtension;
  const client = useMemo(() => getAuthenticatedBrowserApiClient(), []);
  const [devices, setDevices] = useState(initialDevices);
  const [detections, setDetections] = useState(initialDetections);
  const [pairingCode, setPairingCode] = useState<BrowserExtensionPairingCodeResponse | null>(null);
  const [sendPageTitle, setSendPageTitle] = useState(initialSettings.sendPageTitle);
  const [hardBlockedUrlPatterns, setHardBlockedUrlPatterns] = useState(
    joinPatterns(initialSettings.hardBlockedUrlPatterns),
  );
  const [sensitiveUrlPatterns, setSensitiveUrlPatterns] = useState(joinPatterns(initialSettings.sensitiveUrlPatterns));
  const [expandedBatchIds, setExpandedBatchIds] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  const refreshData = async () => {
    setBusyAction("refresh");

    try {
      const [settingsResponse, devicesResponse, detectionsResponse] = await Promise.all([
        client.GET<BrowserExtensionSettingsResponse>("/browser-extension/settings"),
        client.GET<BrowserExtensionDevicesResponse>("/browser-extension/devices"),
        client.GET<BrowserExtensionDomainDetectionsResponse>("/browser-extension/detections/domains", {
          params: { query: { page: 1, pageSize: detections.pagination.pageSize } },
        }),
      ]);

      if (!settingsResponse.response.ok || !settingsResponse.data) {
        toast.error(await getApiErrorMessage(settingsResponse.response));
        return;
      }

      if (!devicesResponse.response.ok || !devicesResponse.data) {
        toast.error(await getApiErrorMessage(devicesResponse.response));
        return;
      }

      if (!detectionsResponse.response.ok || !detectionsResponse.data) {
        toast.error(await getApiErrorMessage(detectionsResponse.response));
        return;
      }

      setDevices(devicesResponse.data);
      setDetections(detectionsResponse.data);
      setSendPageTitle(settingsResponse.data.sendPageTitle);
      setHardBlockedUrlPatterns(joinPatterns(settingsResponse.data.hardBlockedUrlPatterns));
      setSensitiveUrlPatterns(joinPatterns(settingsResponse.data.sensitiveUrlPatterns));
    } catch {
      toast.error(browserExtensionMessages.toasts.refreshFailed);
    } finally {
      setBusyAction(null);
    }
  };

  const generatePairingCode = async () => {
    setBusyAction("pairing");

    try {
      const { data, response } = await client.POST<BrowserExtensionPairingCodeResponse>(
        "/browser-extension/pairing-codes",
        {
          headers: { "x-yapd-csrf": csrfToken },
          body: {},
        },
      );

      if (!response.ok || !data) {
        toast.error(await getApiErrorMessage(response));
        return;
      }

      setPairingCode(data);
      toast.success(browserExtensionMessages.toasts.pairingCreated);
    } catch {
      toast.error(browserExtensionMessages.toasts.pairingFailed);
    } finally {
      setBusyAction(null);
    }
  };

  const saveSettings = async () => {
    setBusyAction("settings");

    try {
      const nextSettings = {
        sendPageTitle,
        hardBlockedUrlPatterns: splitPatterns(hardBlockedUrlPatterns),
        sensitiveUrlPatterns: splitPatterns(sensitiveUrlPatterns),
      };
      const { data, response } = await client.PATCH<BrowserExtensionSettingsResponse>("/browser-extension/settings", {
        headers: { "x-yapd-csrf": csrfToken },
        body: nextSettings,
      });

      if (!response.ok || !data) {
        toast.error(await getApiErrorMessage(response));
        return;
      }

      toast.success(browserExtensionMessages.toasts.settingsSaved);
    } catch {
      toast.error(browserExtensionMessages.toasts.settingsFailed);
    } finally {
      setBusyAction(null);
    }
  };

  const revokeDevice = async (id: string) => {
    setBusyAction(`revoke:${id}`);

    try {
      const { data, response } = await client.POST<BrowserExtensionDeviceRevokeResponse>(
        "/browser-extension/devices/{id}/revoke",
        {
          headers: { "x-yapd-csrf": csrfToken },
          params: { path: { id } },
          body: {},
        },
      );

      if (!response.ok || !data) {
        toast.error(await getApiErrorMessage(response));
        return;
      }

      setDevices((current) => ({
        items: current.items.map((device) =>
          device.id === data.id ? { ...device, revokedAt: data.revokedAt } : device,
        ),
      }));
      toast.success(browserExtensionMessages.toasts.deviceRevoked);
    } catch {
      toast.error(browserExtensionMessages.toasts.revokeFailed);
    } finally {
      setBusyAction(null);
    }
  };

  const toggleBatchExpansion = (id: string) => {
    setExpandedBatchIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.65fr)]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{browserExtensionMessages.pairing.title}</CardTitle>
              <CardDescription>{browserExtensionMessages.pairing.description}</CardDescription>
            </div>
            <Button disabled={busyAction !== null} onClick={generatePairingCode}>
              <KeyRound />
              {busyAction === "pairing"
                ? browserExtensionMessages.pairing.generating
                : browserExtensionMessages.pairing.generate}
            </Button>
          </CardHeader>
          <CardContent>
            {pairingCode ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border px-4 py-3">
                  <p className="text-muted-foreground text-xs">{browserExtensionMessages.pairing.code}</p>
                  <p className="font-mono font-semibold text-3xl tracking-widest">{pairingCode.pairingCode}</p>
                </div>
                <div className="rounded-md border px-4 py-3">
                  <p className="text-muted-foreground text-xs">{browserExtensionMessages.pairing.expiresAt}</p>
                  <p className="font-medium">{formatDate(pairingCode.expiresAt, locale)}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{browserExtensionMessages.pairing.empty}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{browserExtensionMessages.settings.title}</CardTitle>
              <CardDescription>{browserExtensionMessages.settings.description}</CardDescription>
            </div>
            <Button disabled={busyAction !== null} variant="outline" onClick={refreshData}>
              <RefreshCw className={cn(busyAction === "refresh" && "animate-spin")} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <FieldLabel>{browserExtensionMessages.settings.sendPageTitle}</FieldLabel>
              <Switch checked={sendPageTitle} onCheckedChange={setSendPageTitle} />
            </div>
            <Field>
              <FieldLabel>{browserExtensionMessages.settings.hardBlocked}</FieldLabel>
              <Textarea
                className="min-h-24 font-mono text-xs"
                placeholder={browserExtensionMessages.settings.patternsPlaceholder}
                value={hardBlockedUrlPatterns}
                onChange={(event) => setHardBlockedUrlPatterns(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{browserExtensionMessages.settings.sensitive}</FieldLabel>
              <Textarea
                className="min-h-24 font-mono text-xs"
                placeholder={browserExtensionMessages.settings.patternsPlaceholder}
                value={sensitiveUrlPatterns}
                onChange={(event) => setSensitiveUrlPatterns(event.target.value)}
              />
            </Field>
            <Button disabled={busyAction !== null} onClick={saveSettings}>
              <Save />
              {busyAction === "settings"
                ? browserExtensionMessages.settings.saving
                : browserExtensionMessages.settings.save}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{browserExtensionMessages.devices.title}</CardTitle>
          <CardDescription>{browserExtensionMessages.devices.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {devices.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{browserExtensionMessages.devices.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{browserExtensionMessages.devices.name}</TableHead>
                    <TableHead>{browserExtensionMessages.devices.browser}</TableHead>
                    <TableHead>{browserExtensionMessages.devices.version}</TableHead>
                    <TableHead>{browserExtensionMessages.devices.manifest}</TableHead>
                    <TableHead>{browserExtensionMessages.devices.lastSeen}</TableHead>
                    <TableHead>{browserExtensionMessages.devices.status}</TableHead>
                    <TableHead className="text-right">{browserExtensionMessages.devices.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.items.map((device) => {
                    const isRevoked = Boolean(device.revokedAt);

                    return (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">{device.name}</TableCell>
                        <TableCell>{device.browser}</TableCell>
                        <TableCell>{device.extensionVersion}</TableCell>
                        <TableCell>MV{device.manifestVersion}</TableCell>
                        <TableCell>{formatDate(device.lastSeenAt, locale)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(isRevoked ? "revoked" : "active")}>
                            {isRevoked
                              ? browserExtensionMessages.devices.revoked
                              : browserExtensionMessages.devices.active}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            disabled={isRevoked || busyAction !== null}
                            size="sm"
                            variant="outline"
                            onClick={() => revokeDevice(device.id)}
                          >
                            <ShieldOff />
                            {busyAction === `revoke:${device.id}`
                              ? browserExtensionMessages.devices.revoking
                              : browserExtensionMessages.devices.revoke}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{browserExtensionMessages.history.title}</CardTitle>
          <CardDescription>{browserExtensionMessages.history.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {detections.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{browserExtensionMessages.history.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{browserExtensionMessages.history.pageDomain}</TableHead>
                    <TableHead>{browserExtensionMessages.history.date}</TableHead>
                    <TableHead>{browserExtensionMessages.history.count}</TableHead>
                    <TableHead>{browserExtensionMessages.history.blocked}</TableHead>
                    <TableHead>{browserExtensionMessages.history.notBlocked}</TableHead>
                    <TableHead>{browserExtensionMessages.history.status}</TableHead>
                    <TableHead className="text-right">{browserExtensionMessages.history.details}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detections.items.map((domainGroup) => {
                    const expanded = expandedBatchIds.includes(domainGroup.pageMainDomain);

                    return (
                      <Fragment key={domainGroup.pageMainDomain}>
                        <TableRow>
                          <TableCell className="font-medium">
                            <div className="grid gap-1">
                              <span>{domainGroup.pageMainDomain}</span>
                              {domainGroup.latestPageDomain !== domainGroup.pageMainDomain && (
                                <span className="text-muted-foreground text-xs">{domainGroup.latestPageDomain}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(domainGroup.lastDetectedAt, locale)}</TableCell>
                          <TableCell>{domainGroup.totalDetected}</TableCell>
                          <TableCell>{domainGroup.blockedCount}</TableCell>
                          <TableCell>{domainGroup.notBlockedCount}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(domainGroup.status)}>{domainGroup.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleBatchExpansion(domainGroup.pageMainDomain)}
                            >
                              {expanded ? <ChevronDown /> : <ChevronRight />}
                              {expanded
                                ? browserExtensionMessages.history.hideDetails
                                : browserExtensionMessages.history.details}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow key={`${domainGroup.pageMainDomain}:details`}>
                            <TableCell colSpan={7}>
                              <div className="space-y-3 py-2">
                                {domainGroup.targetGroups.map((targetGroup) => (
                                  <div key={targetGroup.targetMainDomain} className="rounded-md border p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="text-muted-foreground text-xs">
                                          {browserExtensionMessages.history.target}
                                        </p>
                                        <p className="break-all font-medium font-mono text-sm">
                                          {targetGroup.targetMainDomain}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary">
                                          {targetGroup.totalDetected} {browserExtensionMessages.history.count}
                                        </Badge>
                                        <Badge variant="default">
                                          {targetGroup.blockedCount} {browserExtensionMessages.history.blocked}
                                        </Badge>
                                        <Badge variant="outline">
                                          {targetGroup.notBlockedCount} {browserExtensionMessages.history.notBlocked}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="mt-3 space-y-3">
                                      {targetGroup.items.map((item) => (
                                        <div key={item.id} className="rounded-md bg-muted/50 p-3">
                                          <div className="grid gap-3 md:grid-cols-6">
                                            <div className="md:col-span-2">
                                              <p className="text-muted-foreground text-xs">
                                                {browserExtensionMessages.history.target}
                                              </p>
                                              <p className="break-all font-mono text-sm">{item.target}</p>
                                            </div>
                                            <div>
                                              <p className="text-muted-foreground text-xs">
                                                {browserExtensionMessages.history.kind}
                                              </p>
                                              <Badge variant="outline">{item.kind}</Badge>
                                            </div>
                                            <div>
                                              <p className="text-muted-foreground text-xs">
                                                {browserExtensionMessages.history.category}
                                              </p>
                                              <p className="text-sm">{item.category}</p>
                                            </div>
                                            <div>
                                              <p className="text-muted-foreground text-xs">
                                                {browserExtensionMessages.history.score}
                                              </p>
                                              <p className="text-sm">{item.score}</p>
                                            </div>
                                            <div>
                                              <p className="text-muted-foreground text-xs">
                                                {browserExtensionMessages.history.status}
                                              </p>
                                              <Badge variant={getStatusVariant(item.applyStatus)}>
                                                {item.applyStatus}
                                              </Badge>
                                            </div>
                                          </div>
                                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                                            <div>
                                              <p className="text-muted-foreground text-xs">
                                                {browserExtensionMessages.history.reasons}
                                              </p>
                                              <p className="text-sm">{item.reasons.join(", ")}</p>
                                            </div>
                                            <div>
                                              <p className="text-muted-foreground text-xs">
                                                {browserExtensionMessages.history.evidence}
                                              </p>
                                              <pre className="max-h-28 overflow-auto rounded bg-background p-2 text-xs">
                                                {JSON.stringify(item.evidence, null, 2)}
                                              </pre>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
