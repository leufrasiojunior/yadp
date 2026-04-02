"use client";

import { CheckLine, ChevronDown, Globe, RegexIcon, ShieldBan } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DomainOperationResponse, QueriesResponse } from "@/lib/api/yapd-types";
import type { WebMessages } from "@/lib/i18n/messages";

type DomainActionType = DomainOperationResponse["request"]["type"];
type DomainActionKind = DomainOperationResponse["request"]["kind"];

type QueryActionCellProps = {
  isAnyDomainActionPending: (query: QueriesResponse["queries"][number]) => boolean;
  isDomainActionPending: (
    query: QueriesResponse["queries"][number],
    type: DomainActionType,
    kind: DomainActionKind,
  ) => boolean;
  messages: WebMessages;
  query: QueriesResponse["queries"][number];
  submitDomainAction: (
    query: QueriesResponse["queries"][number],
    type: DomainActionType,
    kind: DomainActionKind,
  ) => Promise<void>;
};

function normalizeStatus(status: string | null) {
  return status?.trim().toUpperCase() ?? "";
}

export function QueryActionCell({
  isAnyDomainActionPending,
  isDomainActionPending,
  messages,
  query,
  submitDomainAction,
}: Readonly<QueryActionCellProps>) {
  const domain = query.domain?.trim() ?? "";

  if (!domain) {
    return null;
  }

  const normalizedStatus = normalizeStatus(query.status);
  const rowPending = isAnyDomainActionPending(query);

  if (normalizedStatus === "CACHE" || normalizedStatus === "FORWARDED" || normalizedStatus === "CACHE_STALE") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start gap-1.5" disabled={rowPending}>
            <ShieldBan className="size-4" color="#940a0a" />
            <span className="flex-1 text-left">
              {rowPending ? messages.queries.actions.applying : messages.queries.actions.block}
            </span>
            <ChevronDown className="size-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-49">
          <DropdownMenuItem onSelect={() => void submitDomainAction(query, "deny", "exact")}>
            <Globe />
            {messages.queries.actions.blockDomain}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void submitDomainAction(query, "deny", "regex")}>
            <RegexIcon />
            {messages.queries.actions.blockRegex}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (normalizedStatus === "GRAVITY" || normalizedStatus === "DENYLIST") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-1.5"
        disabled={isDomainActionPending(query, "allow", "exact")}
        onClick={() => void submitDomainAction(query, "allow", "exact")}
      >
        <CheckLine className="size-4" color="#239721" />
        <span className="flex-1 text-left">
          {isDomainActionPending(query, "allow", "exact")
            ? messages.queries.actions.applying
            : messages.queries.actions.allow}
        </span>
      </Button>
    );
  }

  return null;
}
