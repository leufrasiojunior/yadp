"use client";

import { useState } from "react";

import { Tags } from "lucide-react";

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
import type { DomainItem, GroupItem } from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";

interface DomainGroupEditorProps {
  readonly item: DomainItem;
  readonly groups: GroupItem[];
  readonly onSave: (groupIds: number[]) => Promise<void>;
  readonly disabled?: boolean;
}

export function DomainGroupEditor({ item, groups, onSave, disabled }: DomainGroupEditorProps) {
  const { messages } = useWebI18n();
  const [open, setOpen] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>(item.groups);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (selectedGroupIds.length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(selectedGroupIds);
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleGroup = (groupId: number, checked: boolean) => {
    setSelectedGroupIds((current) =>
      checked ? [...new Set([...current, groupId])] : current.filter((id) => id !== groupId),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        className="h-9 w-full justify-start gap-2 overflow-hidden"
        onClick={() => setOpen(true)}
      >
        <Tags className="h-4 w-4 shrink-0" />
        <div className="pointer-events-none flex min-w-0 gap-1 overflow-hidden">
          {item.groups.length > 0 ? (
            item.groups.slice(0, 2).map((groupId) => {
              const group = groups.find((g) => g.id === groupId);
              return (
                <Badge key={groupId} variant="secondary" className="h-5 px-1 text-[10px]">
                  {group?.name ?? groupId}
                </Badge>
              );
            })
          ) : (
            <span className="text-muted-foreground text-xs">{messages.common.notConfigured}</span>
          )}
          {item.groups.length > 2 && (
            <Badge variant="secondary" className="h-5 px-1 text-[10px]">
              +{item.groups.length - 2}
            </Badge>
          )}
        </div>
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{messages.domains.groupEditor.title}</DialogTitle>
          <DialogDescription>{messages.domains.groupEditor.description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {groups.map((group) => {
            const checkboxId = `domain-groups-${item.id}-${group.id}`;
            return (
              <div key={group.id} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                <Checkbox
                  id={checkboxId}
                  checked={selectedGroupIds.includes(group.id)}
                  disabled={isSaving}
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
          <p className="text-destructive text-xs">{messages.domains.groupEditor.groupsRequired}</p>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => setOpen(false)}>
            {messages.domains.groupEditor.cancel}
          </Button>
          <Button disabled={isSaving || selectedGroupIds.length === 0} onClick={handleSave}>
            {isSaving ? messages.domains.groupEditor.saving : messages.domains.groupEditor.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
