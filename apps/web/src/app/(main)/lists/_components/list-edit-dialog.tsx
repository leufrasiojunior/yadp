"use client";

import { useState } from "react";

import { Calendar, CheckCircle2, Clock, Copy, Database, FileText, Globe, RefreshCw, Tag } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GroupItem, ListItem } from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface ListEditDialogProps {
  readonly list: ListItem;
  readonly groups: GroupItem[];
  readonly onSave: (groupIds: number[], comment: string | null) => Promise<void>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly disabled?: boolean;
}

export function ListEditDialog({ list, groups, onSave, open, onOpenChange, disabled }: ListEditDialogProps) {
  const { messages, locale } = useWebI18n();
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>(list.groups);
  const [comment, setComment] = useState<string>(list.comment ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (selectedGroupIds.length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(selectedGroupIds, comment.trim() || null);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleGroup = (groupId: number, checked: boolean) => {
    setSelectedGroupIds((current) =>
      checked ? [...new Set([...current, groupId])] : current.filter((id) => id !== groupId),
    );
  };

  const formatDate = (unixSeconds: number | null) => {
    if (unixSeconds === null || unixSeconds === 0) return "-";
    return new Date(unixSeconds * 1000).toLocaleString(locale);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(messages.common.copied);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{messages.lists.groupEditor.title}</DialogTitle>
          <DialogDescription>{messages.lists.groupEditor.description}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">{messages.lists.groupEditor.tabs.general}</TabsTrigger>
            <TabsTrigger value="groups">{messages.lists.groupEditor.tabs.groups}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Type and Status First Row */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5" />
                  {messages.lists.groupEditor.fields.type}
                </Label>
                <div className="flex h-10 items-center">
                  <Badge
                    variant="outline"
                    className={cn(
                      "uppercase",
                      list.type === "allow" ? "border-emerald-500 text-emerald-600" : "border-rose-500 text-rose-600",
                    )}
                  >
                    {list.type}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {messages.lists.groupEditor.fields.enabled}
                </Label>
                <div className="flex h-10 items-center">
                  <Badge variant={list.enabled ? "default" : "secondary"}>
                    {list.enabled ? messages.lists.status.enabled : messages.lists.status.disabled}
                  </Badge>
                </div>
              </div>

              {/* Address Second Row (Full Width) */}
              <div className="col-span-2 space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  {messages.lists.groupEditor.fields.address}
                </Label>
                <div className="flex gap-2">
                  <Input value={list.address} readOnly className="bg-muted font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(list.address)}
                    title="Copy Address"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Other fields */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5" />
                  {messages.lists.groupEditor.fields.itemCount}
                </Label>
                <Input value={list.number?.toLocaleString() ?? "0"} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  {messages.lists.groupEditor.fields.dateAdded}
                </Label>
                <Input value={formatDate(list.dateAdded)} readOnly className="bg-muted text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  {messages.lists.groupEditor.fields.dateModified}
                </Label>
                <Input value={formatDate(list.dateModified)} readOnly className="bg-muted text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5" />
                  {messages.lists.groupEditor.fields.lastUpdated}
                </Label>
                <Input value={formatDate(list.dateUpdated)} readOnly className="bg-muted text-sm" />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit-comment" className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  {messages.lists.groupEditor.fields.comment}
                </Label>
                <Input
                  id="edit-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={isSaving || disabled}
                  placeholder="..."
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="groups" className="space-y-4 py-4">
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {groups.map((group) => {
                const checkboxId = `edit-list-groups-${list.id}-${group.id}`;
                return (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={selectedGroupIds.includes(group.id)}
                      disabled={isSaving || disabled}
                      onCheckedChange={(checked) => toggleGroup(group.id, checked === true)}
                    />
                    <label htmlFor={checkboxId} className="flex flex-1 cursor-pointer items-center justify-between">
                      <span className="font-medium">{group.name}</span>
                      {group.id === 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          Default
                        </Badge>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>
            {selectedGroupIds.length === 0 && (
              <p className="text-destructive text-xs">{messages.lists.groupEditor.groupsRequired}</p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            {messages.lists.groupEditor.cancel}
          </Button>
          <Button disabled={isSaving || selectedGroupIds.length === 0} onClick={handleSave}>
            {isSaving ? messages.lists.groupEditor.saving : messages.lists.groupEditor.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
