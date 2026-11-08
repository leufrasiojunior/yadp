"use client";

import { useMemo, useState } from "react";

import {
  Check,
  Copy,
  KeyRound,
  RefreshCw,
  Save,
  Search,
  ShieldBan,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getAuthenticatedBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  BrowserExtensionDeviceRevokeResponse,
  BrowserExtensionDevicesResponse,
  BrowserExtensionDomainDetectionItem,
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

type BusyAction =
  | "pairing"
  | "settings"
  | "refresh"
  | "clear"
  | `revoke:${string}`
  | `block:${string}`
  | `allow:${string}`
  | null;

type FlattenedTargetItem = BrowserExtensionDomainDetectionItem & {
  pageMainDomain: string;
  latestPageDomain: string;
  latestPageUrl: string | null;
  latestPageTitle: string | null;
};

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
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  // Estados da tabela limpa de alvos e modal de JSON
  const [selectedPageFilter, setSelectedPageFilter] = useState<string>("ALL");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [selectedItemForModal, setSelectedItemForModal] = useState<FlattenedTargetItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

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

  const handleBlockDomain = async (domain: string) => {
    setBusyAction(`block:${domain}`);

    // Atualização otimista imediata na tabela
    setDetections((prev) => ({
      ...prev,
      items: prev.items.map((group) => ({
        ...group,
        targetGroups: group.targetGroups.map((tg) => ({
          ...tg,
          items: tg.items.map((item) =>
            item.target.toLowerCase() === domain.toLowerCase() ||
            item.targetMainDomain.toLowerCase() === domain.toLowerCase()
              ? { ...item, applyStatus: "blocked" as const }
              : item,
          ),
        })),
      })),
    }));

    try {
      const { response } = await client.POST("/domains/{type}/{kind}", {
        headers: { "x-yapd-csrf": csrfToken },
        params: { path: { type: "deny", kind: "exact" } },
        body: { domain, comment: "Added from YAPD Inspector" },
      });

      if (!response.ok) {
        toast.error(await getApiErrorMessage(response));
        await refreshData();
        return;
      }

      toast.success(browserExtensionMessages.toasts.domainBlocked);
      await refreshData();
    } catch {
      toast.error(browserExtensionMessages.toasts.domainBlockFailed);
      await refreshData();
    } finally {
      setBusyAction(null);
    }
  };

  const handleAllowDomain = async (domain: string) => {
    setBusyAction(`allow:${domain}`);

    // Atualização otimista imediata na tabela
    setDetections((prev) => ({
      ...prev,
      items: prev.items.map((group) => ({
        ...group,
        targetGroups: group.targetGroups.map((tg) => ({
          ...tg,
          items: tg.items.map((item) =>
            item.target.toLowerCase() === domain.toLowerCase() ||
            item.targetMainDomain.toLowerCase() === domain.toLowerCase()
              ? { ...item, applyStatus: "allowed" as const }
              : item,
          ),
        })),
      })),
    }));

    try {
      const { response } = await client.POST("/domains/{type}/{kind}", {
        headers: { "x-yapd-csrf": csrfToken },
        params: { path: { type: "allow", kind: "exact" } },
        body: { domain, comment: "Added from YAPD Inspector" },
      });

      if (!response.ok) {
        toast.error(await getApiErrorMessage(response));
        await refreshData();
        return;
      }

      toast.success(browserExtensionMessages.toasts.domainAllowed);
      await refreshData();
    } catch {
      toast.error(browserExtensionMessages.toasts.domainAllowFailed);
      await refreshData();
    } finally {
      setBusyAction(null);
    }
  };

  const handleClearHistory = async () => {
    setBusyAction("clear");

    try {
      const { response } = await client.POST("/browser-extension/detections/clear", {
        headers: { "x-yapd-csrf": csrfToken },
      });

      if (!response.ok) {
        toast.error(await getApiErrorMessage(response));
        return;
      }

      setDetections({
        items: [],
        pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
      });
      setClearConfirmOpen(false);
      toast.success(browserExtensionMessages.toasts.historyCleared);
    } catch {
      toast.error(browserExtensionMessages.toasts.historyClearFailed);
    } finally {
      setBusyAction(null);
    }
  };

  // Consolidação de todos os alvos detectados de forma plana para exibição em tabela limpa
  const allTargetItems = useMemo(() => {
    const list: FlattenedTargetItem[] = [];

    for (const group of detections.items) {
      for (const targetGroup of group.targetGroups) {
        for (const item of targetGroup.items) {
          list.push({
            ...item,
            pageMainDomain: group.pageMainDomain,
            latestPageDomain: group.latestPageDomain,
            latestPageUrl: group.latestPageUrl,
            latestPageTitle: group.latestPageTitle,
          });
        }
      }
    }

    return list;
  }, [detections]);

  // Lista de páginas distintas para o filtro
  const availablePages = useMemo(() => {
    return Array.from(new Set(detections.items.map((g) => g.pageMainDomain)));
  }, [detections]);

  // Filtragem por página selecionada e busca textual
  const filteredTargetItems = useMemo(() => {
    let result = allTargetItems;

    if (selectedPageFilter !== "ALL") {
      result = result.filter((item) => item.pageMainDomain === selectedPageFilter);
    }

    if (searchFilter.trim().length > 0) {
      const q = searchFilter.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.target.toLowerCase().includes(q) ||
          item.targetMainDomain.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.pageDomain.toLowerCase().includes(q),
      );
    }

    return result;
  }, [allTargetItems, selectedPageFilter, searchFilter]);

  const handleCopyJson = () => {
    if (!selectedItemForModal) return;
    navigator.clipboard.writeText(JSON.stringify(selectedItemForModal, null, 2));
    setIsCopied(true);
    toast.success(browserExtensionMessages.history.jsonCopied);
    setTimeout(() => setIsCopied(false), 2000);
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

      {/* Tabela Limpa e Direta de Alvos Detectados */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{browserExtensionMessages.history.title}</CardTitle>
            <CardDescription>{browserExtensionMessages.history.description}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {availablePages.length > 1 && (
              <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1 text-xs">
                <Button
                  size="sm"
                  variant={selectedPageFilter === "ALL" ? "default" : "ghost"}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setSelectedPageFilter("ALL")}
                >
                  {browserExtensionMessages.history.filterAllPages} ({allTargetItems.length})
                </Button>
                {availablePages.map((page) => (
                  <Button
                    key={page}
                    size="sm"
                    variant={selectedPageFilter === page ? "default" : "ghost"}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setSelectedPageFilter(page)}
                  >
                    {page}
                  </Button>
                ))}
              </div>
            )}
            <div className="relative w-full sm:w-64">
              <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder={browserExtensionMessages.history.searchPlaceholder}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive"
              disabled={allTargetItems.length === 0 || busyAction !== null}
              onClick={() => setClearConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" />
              {browserExtensionMessages.history.clearHistory}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTargetItems.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground text-sm">{browserExtensionMessages.history.empty}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[34%]">{browserExtensionMessages.history.target}</TableHead>
                    <TableHead className="w-[16%]">{browserExtensionMessages.history.category}</TableHead>
                    <TableHead className="w-[12%]">{browserExtensionMessages.history.score}</TableHead>
                    <TableHead className="w-[14%]">{browserExtensionMessages.history.kind}</TableHead>
                    <TableHead className="w-[24%] text-right">{browserExtensionMessages.history.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTargetItems.map((item) => {
                    const isBlocked = item.applyStatus === "blocked" || item.applyStatus === "applied";
                    const isAllowed = item.applyStatus === "allowed";

                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                        onClick={() => setSelectedItemForModal(item)}
                      >
                        {/* 1. Target */}
                        <TableCell className="font-medium">
                          <div className="grid gap-0.5">
                            <span className="break-all font-mono text-foreground text-sm">{item.target}</span>
                            {item.pageDomain && item.pageDomain !== item.target && (
                              <span className="max-w-[280px] truncate text-muted-foreground text-xs">
                                via {item.pageDomain}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 2. Categoria */}
                        <TableCell>
                          <Badge variant="secondary" className="font-normal text-xs capitalize">
                            {item.category.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>

                        {/* 3. Score */}
                        <TableCell>
                          <Badge
                            variant={item.score >= 70 ? "destructive" : item.score >= 40 ? "secondary" : "outline"}
                            className="font-mono font-semibold"
                          >
                            {item.score}
                          </Badge>
                        </TableCell>

                        {/* 4. Formato */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="font-mono text-xs">
                              {item.kind}
                            </Badge>
                            {item.evidence && typeof item.evidence.elementTag === "string" && (
                              <span className="font-mono text-muted-foreground text-xs">
                                &lt;{item.evidence.elementTag}&gt;
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 5. Ações (Permitir, Bloquear, se já bloqueado informar) */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isBlocked ? (
                              <>
                                <Badge
                                  variant="default"
                                  className="h-7 gap-1 border-red-500/25 bg-red-500/15 px-2.5 font-medium text-red-600 text-xs dark:text-red-400"
                                >
                                  <ShieldBan className="size-3.5" />
                                  {browserExtensionMessages.history.alreadyBlocked}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  disabled={busyAction !== null}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAllowDomain(item.targetMainDomain || item.target);
                                  }}
                                >
                                  <ShieldCheck className="mr-1 size-3.5" />
                                  {browserExtensionMessages.history.allowDomain}
                                </Button>
                              </>
                            ) : isAllowed ? (
                              <>
                                <Badge
                                  variant="outline"
                                  className="h-7 gap-1 border-emerald-500/25 bg-emerald-500/10 px-2.5 font-medium text-emerald-600 text-xs dark:text-emerald-400"
                                >
                                  <ShieldCheck className="size-3.5" />
                                  {browserExtensionMessages.history.alreadyAllowed}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2 text-xs"
                                  disabled={busyAction !== null}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBlockDomain(item.targetMainDomain || item.target);
                                  }}
                                >
                                  <ShieldBan className="mr-1 size-3.5" />
                                  {browserExtensionMessages.history.blockDomain}
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={busyAction !== null}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAllowDomain(item.targetMainDomain || item.target);
                                  }}
                                >
                                  <ShieldCheck className="mr-1 size-3.5" />
                                  {browserExtensionMessages.history.allowDomain}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  disabled={busyAction !== null}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBlockDomain(item.targetMainDomain || item.target);
                                  }}
                                >
                                  <ShieldBan className="mr-1 size-3.5" />
                                  {browserExtensionMessages.history.blockDomain}
                                </Button>
                              </>
                            )}
                          </div>
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

      {/* Modal com Payload JSON e Evidências ao Clicar na Linha */}
      <Dialog open={Boolean(selectedItemForModal)} onOpenChange={(open) => !open && setSelectedItemForModal(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 break-all font-mono text-base">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <span>{selectedItemForModal?.target}</span>
            </DialogTitle>
            <DialogDescription>{browserExtensionMessages.history.detailsModalDescription}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-auto py-2">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-md border p-2.5">
                <span className="mb-0.5 block text-muted-foreground">Domínio Principal:</span>
                <span className="font-medium font-mono">{selectedItemForModal?.targetMainDomain}</span>
              </div>
              <div className="rounded-md border p-2.5">
                <span className="mb-0.5 block text-muted-foreground">Página Visitada:</span>
                <span className="block truncate font-medium font-mono">{selectedItemForModal?.pageDomain || "-"}</span>
              </div>
              <div className="rounded-md border p-2.5">
                <span className="mb-0.5 block text-muted-foreground">Categoria / Score:</span>
                <span className="font-medium">
                  {selectedItemForModal?.category} (Score: {selectedItemForModal?.score}/100)
                </span>
              </div>
              <div className="rounded-md border p-2.5">
                <span className="mb-0.5 block text-muted-foreground">Status no Pi-hole:</span>
                <span className="font-medium capitalize">{selectedItemForModal?.applyStatus}</span>
              </div>
            </div>

            {selectedItemForModal?.reasons && selectedItemForModal.reasons.length > 0 && (
              <div className="rounded-md border p-3">
                <span className="mb-1 block font-medium text-muted-foreground text-xs">Motivos da Classificação:</span>
                <ul className="list-inside list-disc space-y-0.5 text-foreground/80 text-xs">
                  {selectedItemForModal.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-medium text-muted-foreground text-xs">Payload JSON Completo:</span>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={handleCopyJson}>
                  {isCopied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  {isCopied ? "Copiado!" : browserExtensionMessages.history.copyJson}
                </Button>
              </div>
              <pre className="max-h-64 overflow-auto rounded-lg border bg-zinc-950 p-3 font-mono text-xs text-zinc-100 dark:bg-zinc-900">
                {selectedItemForModal ? JSON.stringify(selectedItemForModal, null, 2) : ""}
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItemForModal(null)}>
              {browserExtensionMessages.history.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Limpeza de Histórico */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              <span>{browserExtensionMessages.history.clearConfirmTitle}</span>
            </DialogTitle>
            <DialogDescription>{browserExtensionMessages.history.clearConfirmDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setClearConfirmOpen(false)} disabled={busyAction === "clear"}>
              {browserExtensionMessages.history.cancel}
            </Button>
            <Button variant="destructive" onClick={handleClearHistory} disabled={busyAction === "clear"}>
              <Trash2 className="mr-1.5 size-4" />
              {busyAction === "clear"
                ? browserExtensionMessages.history.clearing
                : browserExtensionMessages.history.clearConfirmButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
