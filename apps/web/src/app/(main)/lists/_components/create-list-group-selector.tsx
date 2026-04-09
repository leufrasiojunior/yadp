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
  DialogTrigger,
} from "@/components/ui/dialog";
import type { GroupItem } from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";

interface CreateListGroupSelectorProps {
  readonly groups: GroupItem[];
  readonly selectedGroupIds: number[];
  readonly onChange: (groupIds: number[]) => void;
  readonly disabled?: boolean;
}

export function CreateListGroupSelector({
  groups,
  selectedGroupIds,
  onChange,
  disabled,
}: CreateListGroupSelectorProps) {
  const { messages } = useWebI18n();
  const [open, setOpen] = useState(false);

  const toggleGroup = (groupId: number, checked: boolean) => {
    const nextIds = checked
      ? [...new Set([...selectedGroupIds, groupId])]
      : selectedGroupIds.filter((id) => id !== groupId);
    onChange(nextIds);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="h-10 w-full justify-start gap-2">
          <Tags className="h-4 w-4 shrink-0" />
          <div className="flex gap-1 overflow-hidden">
            {selectedGroupIds.length > 0 ? (
              selectedGroupIds.slice(0, 2).map((groupId) => {
                const group = groups.find((g) => g.id === groupId);
                return (
                  <Badge key={groupId} variant="secondary" className="h-5 px-1 text-[10px]">
                    {group?.name ?? groupId}
                  </Badge>
                );
              })
            ) : (
              <span className="text-muted-foreground text-sm">{messages.lists.create.groupLabel}</span>
            )}
            {selectedGroupIds.length > 2 && (
              <Badge variant="secondary" className="h-5 px-1 text-[10px]">
                +{selectedGroupIds.length - 2}
              </Badge>
            )}
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{messages.lists.groupEditor.title}</DialogTitle>
          <DialogDescription>{messages.lists.groupEditor.description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {groups.map((group) => {
            const checkboxId = `create-list-groups-${group.id}`;
            return (
              <div key={group.id} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                <Checkbox
                  id={checkboxId}
                  checked={selectedGroupIds.includes(group.id)}
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

        <DialogFooter>
          <Button onClick={() => setOpen(false)}>{messages.lists.groupEditor.cancel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
