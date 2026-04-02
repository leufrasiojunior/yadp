"use client";

import { useId } from "react";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { QuerySuggestionsResponse } from "@/lib/api/yapd-types";
import type { WebMessages } from "@/lib/i18n/messages";
import type { QueryFilters } from "@/lib/queries/queries-filters";
import { cn } from "@/lib/utils";

import { SuggestionInput, SuggestionSelectInput } from "./query-filters-fields";

const FILTER_SUGGESTION_SKELETON_KEYS = Array.from({ length: 7 }, (_value, index) => `query-filter-${index}`);

type QueriesFiltersCardProps = {
  applyFilters: () => void;
  clearFilters: () => void;
  draftFilters: QueryFilters;
  isFiltersOpen: boolean;
  isReloading: boolean;
  isSuggestionsLoading: boolean;
  messages: WebMessages;
  responsiveSummary: string;
  setIsFiltersOpen: (open: boolean) => void;
  setIsLiveEnabled: (enabled: boolean) => void;
  suggestions: QuerySuggestionsResponse["suggestions"];
  updateDraft: <K extends keyof QueryFilters>(key: K, value: QueryFilters[K]) => void;
};

export function QueriesFiltersCard({
  applyFilters,
  clearFilters,
  draftFilters,
  isFiltersOpen,
  isReloading,
  isSuggestionsLoading,
  messages,
  responsiveSummary,
  setIsFiltersOpen,
  setIsLiveEnabled,
  suggestions,
  updateDraft,
}: Readonly<QueriesFiltersCardProps>) {
  const datalistPrefix = useId();

  return (
    <Card className="transition-colors hover:bg-muted/20">
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <CardHeader
          className="flex cursor-pointer flex-row items-start justify-between gap-4"
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
        >
          <div className="space-y-1">
            <CardTitle>{messages.queries.filters.title}</CardTitle>
            <CardDescription>{messages.queries.filters.description}</CardDescription>
            <p className="text-muted-foreground text-xs">{responsiveSummary}</p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" onClick={(event) => event.stopPropagation()}>
              {isFiltersOpen ? messages.queries.filters.hide : messages.queries.filters.show}
              <ChevronDown className={cn("size-4 transition-transform", isFiltersOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                applyFilters();
              }}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <label className="font-medium text-sm" htmlFor={`${datalistPrefix}-from`}>
                    {messages.queries.filters.from}
                  </label>
                  <Input
                    id={`${datalistPrefix}-from`}
                    type="datetime-local"
                    value={draftFilters.from}
                    onChange={(event) => updateDraft("from", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-sm" htmlFor={`${datalistPrefix}-until`}>
                    {messages.queries.filters.until}
                  </label>
                  <Input
                    id={`${datalistPrefix}-until`}
                    type="datetime-local"
                    value={draftFilters.until}
                    onChange={(event) => updateDraft("until", event.target.value)}
                  />
                </div>

                {isSuggestionsLoading ? (
                  FILTER_SUGGESTION_SKELETON_KEYS.map((key) => (
                    <Skeleton key={key} className="h-17 w-full rounded-xl" />
                  ))
                ) : (
                  <>
                    <SuggestionInput
                      inputId={`${datalistPrefix}-domain`}
                      label={messages.queries.filters.domain}
                      placeholder={messages.queries.filters.suggestionPlaceholder}
                      suggestions={suggestions.domain}
                      value={draftFilters.domain}
                      onChange={(value) => updateDraft("domain", value)}
                    />
                    <SuggestionInput
                      inputId={`${datalistPrefix}-client-ip`}
                      label={messages.queries.filters.clientIp}
                      placeholder={messages.queries.filters.suggestionPlaceholder}
                      suggestions={suggestions.client_ip}
                      value={draftFilters.clientIp}
                      onChange={(value) => updateDraft("clientIp", value)}
                    />
                    <SuggestionInput
                      inputId={`${datalistPrefix}-upstream`}
                      label={messages.queries.filters.upstream}
                      placeholder={messages.queries.filters.suggestionPlaceholder}
                      suggestions={suggestions.upstream}
                      value={draftFilters.upstream}
                      onChange={(value) => updateDraft("upstream", value)}
                    />
                    <SuggestionSelectInput
                      inputId={`${datalistPrefix}-type`}
                      label={messages.queries.filters.type}
                      placeholder={messages.queries.filters.suggestionPlaceholder}
                      suggestions={suggestions.type}
                      value={draftFilters.type}
                      onChange={(value) => updateDraft("type", value)}
                    />
                    <SuggestionSelectInput
                      inputId={`${datalistPrefix}-status`}
                      label={messages.queries.filters.status}
                      placeholder={messages.queries.filters.suggestionPlaceholder}
                      suggestions={suggestions.status}
                      value={draftFilters.status}
                      onChange={(value) => updateDraft("status", value)}
                    />
                    <SuggestionSelectInput
                      inputId={`${datalistPrefix}-reply`}
                      label={messages.queries.filters.reply}
                      placeholder={messages.queries.filters.suggestionPlaceholder}
                      suggestions={suggestions.reply}
                      value={draftFilters.reply}
                      onChange={(value) => updateDraft("reply", value)}
                    />
                    <SuggestionSelectInput
                      inputId={`${datalistPrefix}-dnssec`}
                      label={messages.queries.filters.dnssec}
                      placeholder={messages.queries.filters.suggestionPlaceholder}
                      suggestions={suggestions.dnssec}
                      value={draftFilters.dnssec}
                      onChange={(value) => updateDraft("dnssec", value)}
                    />
                    <div className="md:col-span-2 xl:col-span-4">
                      <div className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{messages.queries.filters.disk}</p>
                          <p className="text-muted-foreground text-xs">{messages.queries.filters.diskDescription}</p>
                        </div>
                        <Switch
                          checked={draftFilters.disk}
                          onCheckedChange={(checked) => {
                            const nextValue = Boolean(checked);

                            updateDraft("disk", nextValue);

                            if (nextValue) {
                              setIsLiveEnabled(false);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isReloading}>
                  {isReloading ? messages.queries.filters.applying : messages.queries.filters.apply}
                </Button>
                <Button type="button" variant="outline" disabled={isReloading} onClick={clearFilters}>
                  {messages.queries.filters.clear}
                </Button>
                {isSuggestionsLoading ? (
                  <span className="text-muted-foreground text-xs">{messages.queries.filters.suggestionsLoading}</span>
                ) : null}
              </div>
            </form>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
