"use client";

import { useCallback, useEffect, useState } from "react";

import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getAuthenticatedBrowserApiClient } from "@/lib/api/yapd-client";
import type {
  SubnetApplyResponse,
  SubnetListResponse,
  SubnetPlan,
  SubnetRequest,
  SubnetRule,
} from "@/lib/clients/subnets-types";
import { useWebI18n } from "@/lib/i18n/client";

const EMPTY: SubnetListResponse = { items: [], instances: [], unavailableInstances: [] };

export function SubnetRules({ groups }: Readonly<{ groups: string[] }>) {
  const { messages } = useWebI18n();
  const text = messages.subnets;
  const { csrfToken } = useAppSession();
  const [data, setData] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [client, setClient] = useState("");
  const [comment, setComment] = useState("");
  const [operation, setOperation] = useState<"save" | "delete">("save");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [review, setReview] = useState<{ request: SubnetRequest; plan: SubnetPlan } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getAuthenticatedBrowserApiClient().GET<SubnetListResponse>("/clients/subnets");
      if (!result.response.ok || !result.data) throw new Error(await getApiErrorMessage(result.response));
      setData(result.data);
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.failed);
    }
  }, [text.failed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function edit(rule?: SubnetRule, nextOperation: "save" | "delete" = "save") {
    const preferred =
      rule?.instances.find((instance) => instance.instanceId === data.instances[0]?.instanceId) ?? rule?.instances[0];
    setClient(rule?.client ?? "");
    setComment(preferred?.comment ?? "");
    setSelectedGroups(preferred?.groups ?? []);
    setTargets(data.instances.map((instance) => instance.instanceId));
    setOperation(nextOperation);
    setEditing(Boolean(rule));
    setReview(null);
    setError("");
    setOpen(true);
  }

  async function preview() {
    setBusy(true);
    setError("");
    const request: SubnetRequest = {
      client: client.trim(),
      operation,
      targetInstanceIds: targets,
      ...(operation === "save" ? { groups: selectedGroups, comment } : {}),
    };
    try {
      const result = await getAuthenticatedBrowserApiClient().POST<SubnetPlan>("/clients/subnets/preview", {
        headers: { "x-yapd-csrf": csrfToken },
        body: request,
      });
      if (!result.response.ok || !result.data) throw new Error(await getApiErrorMessage(result.response));
      setReview({ request, plan: result.data });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.failed);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!review) return;
    setBusy(true);
    setError("");
    try {
      const result = await getAuthenticatedBrowserApiClient().POST<SubnetApplyResponse>("/clients/subnets/apply", {
        headers: { "x-yapd-csrf": csrfToken },
        body: { ...review.request, previewToken: review.plan.previewToken },
      });
      if (!result.response.ok || !result.data) throw new Error(await getApiErrorMessage(result.response));
      if (result.data.failedInstances.length) {
        setError(
          result.data.failedInstances.map((instance) => `${instance.instanceName}: ${instance.message}`).join(" · "),
        );
        toast.warning(text.partial);
      } else toast.success(text.applied);
      setOpen(false);
      setReview(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.failed);
      setReview(null);
    } finally {
      setBusy(false);
    }
  }

  const unavailable = new Set(data.unavailableInstances.map((instance) => instance.instanceId));
  const canApply = review?.plan.targets.some((target) => !["unavailable", "unchanged"].includes(target.action));
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{text.title}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setError("");
                void refresh();
              }}
            >
              {text.refresh}
            </Button>
            <Button disabled={busy || !data.instances.length} onClick={() => edit()}>
              {text.add}
            </Button>
          </div>
        </div>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && !open && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {data.unavailableInstances.map((instance) => (
          <Alert key={instance.instanceId} variant="destructive">
            <AlertDescription>
              {instance.instanceName}: {instance.message}
            </AlertDescription>
          </Alert>
        ))}
        {!loaded ? (
          <p>{text.loading}</p>
        ) : !data.items.length ? (
          <p className="text-muted-foreground text-sm">{text.empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{text.subnet}</TableHead>
                <TableHead>{text.instances}</TableHead>
                <TableHead>{text.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((rule) => (
                <TableRow key={rule.client}>
                  <TableCell className="font-mono">{rule.client}</TableCell>
                  <TableCell>
                    <ul className="space-y-1">
                      {data.instances.map((instance) => {
                        const state = rule.instances.find((item) => item.instanceId === instance.instanceId);
                        return (
                          <li key={instance.instanceId} className="text-sm">
                            {instance.instanceName}:{" "}
                            {unavailable.has(instance.instanceId)
                              ? text.unavailable
                              : state
                                ? state.groups.join(", ") || text.noGroups
                                : text.absent}
                          </li>
                        );
                      })}
                    </ul>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" disabled={busy} onClick={() => edit(rule)}>
                        {text.edit}
                      </Button>
                      <Button variant="outline" disabled={busy} onClick={() => edit(rule, "delete")}>
                        {text.remove}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-muted-foreground text-sm">{text.note}</p>
      </CardContent>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{review ? text.review : operation === "delete" ? text.remove : text.edit}</DialogTitle>
            <DialogDescription>{text.description}</DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {review ? (
            <div className="space-y-4">
              <p className="font-mono">{review.plan.client}</p>
              {review.plan.targets.map((target) => (
                <div key={target.instanceId} className="space-y-2 rounded-lg border p-3 text-sm">
                  <p className="font-medium">
                    {target.instanceName}: {text.planActions[target.action]}
                  </p>
                  <p>
                    {text.before}: {target.current ? target.current.groups.join(", ") || text.noGroups : text.absent}
                  </p>
                  {target.current?.comment && <p>{target.current.comment}</p>}
                  <p>
                    {text.after}: {target.desired ? target.desired.groups.join(", ") || text.noGroups : text.absent}
                  </p>
                  {target.desired?.comment && <p>{target.desired.comment}</p>}
                  {target.message && <p className="text-destructive">{target.message}</p>}
                </div>
              ))}
              {operation === "delete" && (
                <Alert>
                  <AlertDescription>{text.deleteNote}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <fieldset disabled={busy} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subnet-client">{text.subnet}</Label>
                <Input
                  id="subnet-client"
                  value={client}
                  onChange={(event) => setClient(event.target.value)}
                  readOnly={editing}
                  placeholder="192.0.2.0/24 or 2001:db8::/64"
                  maxLength={64}
                />
              </div>
              {operation === "save" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="subnet-comment">{text.comment}</Label>
                    <Textarea
                      id="subnet-comment"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      maxLength={500}
                    />
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="mb-2 font-medium text-sm">{text.groups}</legend>
                    {[...new Set(groups)].sort().map((group) => (
                      <label
                        key={group}
                        htmlFor={`subnet-group-${encodeURIComponent(group)}`}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          id={`subnet-group-${encodeURIComponent(group)}`}
                          checked={selectedGroups.includes(group)}
                          onCheckedChange={(checked) =>
                            setSelectedGroups((current) =>
                              checked ? [...current, group] : current.filter((name) => name !== group),
                            )
                          }
                        />
                        {group}
                      </label>
                    ))}
                  </fieldset>
                </>
              )}
              <fieldset className="space-y-2">
                <legend className="mb-2 font-medium text-sm">{text.instances}</legend>
                {data.instances.map((instance) => (
                  <label
                    key={instance.instanceId}
                    htmlFor={`subnet-instance-${instance.instanceId}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      id={`subnet-instance-${instance.instanceId}`}
                      checked={targets.includes(instance.instanceId)}
                      onCheckedChange={(checked) =>
                        setTargets((current) =>
                          checked
                            ? [...current, instance.instanceId]
                            : current.filter((id) => id !== instance.instanceId),
                        )
                      }
                    />
                    {instance.instanceName}
                  </label>
                ))}
              </fieldset>
            </fieldset>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => (review ? setReview(null) : setOpen(false))}>
              {review ? text.back : text.cancel}
            </Button>
            {review ? (
              <Button disabled={busy || !canApply} onClick={() => void apply()}>
                {busy ? text.working : text.apply}
              </Button>
            ) : (
              <Button
                disabled={busy || !client.trim() || !targets.length || (operation === "save" && !selectedGroups.length)}
                onClick={() => void preview()}
              >
                {busy ? text.working : text.preview}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
