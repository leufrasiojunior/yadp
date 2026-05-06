"use client";

import { useEffect, useMemo, useState } from "react";

import { CalendarIcon, ChevronDown, XIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type SuggestionComboboxProps = {
  emptyText: string;
  inputId: string;
  label: string;
  labelClassName?: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  value: string;
};

type DateTimeRangePickerProps = {
  clearLabel: string;
  description?: string;
  fromLabel: string;
  fromValue: string;
  label: string;
  onChange: (value: { from: string; until: string }) => void;
  untilLabel: string;
  untilValue: string;
};

type SuggestionMultiSelectProps = {
  emptyText: string;
  inputId: string;
  label: string;
  labelClassName?: string;
  onChange: (values: number[]) => void;
  options: Array<{
    label: string;
    value: number;
  }>;
  placeholder: string;
  values: number[];
};

function normalizeText(value: string) {
  return value.trim();
}

function toSortedUniqueOptions(
  options: Array<{
    label: string;
    value: number;
  }>,
) {
  const uniqueOptions = new Map<number, { label: string; value: number }>();

  for (const option of options) {
    const normalizedLabel = normalizeText(option.label);

    if (normalizedLabel.length === 0 || !Number.isInteger(option.value) || option.value < 0) {
      continue;
    }

    uniqueOptions.set(option.value, {
      label: normalizedLabel,
      value: option.value,
    });
  }

  return [...uniqueOptions.values()].sort((left, right) => {
    const labelResult = left.label.localeCompare(right.label, undefined, {
      numeric: true,
      sensitivity: "base",
    });

    if (labelResult !== 0) {
      return labelResult;
    }

    return left.value - right.value;
  });
}

function toDatetimeLocalValue(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDatetimeLocalValue(value: string) {
  const normalizedValue = normalizeText(value);

  if (normalizedValue.length === 0) {
    return undefined;
  }

  const parsed = new Date(normalizedValue);

  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

function applyTime(date: Date, timeValue: string) {
  const [hoursText = "0", minutesText = "0"] = timeValue.split(":");
  const nextDate = new Date(date);
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  nextDate.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);

  return nextDate;
}

function getTimeInputValue(value: string, fallback: string) {
  const parsed = parseDatetimeLocalValue(value);

  if (!parsed) {
    return fallback;
  }

  return `${`${parsed.getHours()}`.padStart(2, "0")}:${`${parsed.getMinutes()}`.padStart(2, "0")}`;
}

function formatDatetimeLabel(value: string) {
  return normalizeText(value).replace("T", " ");
}

export function SuggestionCombobox({
  emptyText,
  inputId,
  label,
  labelClassName,
  onChange,
  placeholder,
  suggestions,
  value,
}: Readonly<SuggestionComboboxProps>) {
  const normalizedValue = normalizeText(value);
  const normalizedSuggestions = Array.from(
    new Set(suggestions.map((suggestion) => normalizeText(suggestion)).filter((suggestion) => suggestion.length > 0)),
  );

  return (
    <div className="space-y-2">
      <label className={cn("font-medium text-sm", labelClassName)} htmlFor={inputId}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            id={inputId}
            list={`${inputId}-list`}
            value={value}
            className="appearance-none pr-9 [&::-webkit-calendar-picker-indicator]:hidden"
            placeholder={placeholder}
            aria-describedby={normalizedSuggestions.length === 0 ? `${inputId}-empty` : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
          <ChevronDown className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 size-4 text-muted-foreground" />
        </div>
        {normalizedValue ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`${placeholder}: ${label}`}
            onClick={() => onChange("")}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
      <datalist id={`${inputId}-list`}>
        {normalizedSuggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
      {normalizedSuggestions.length === 0 ? (
        <p id={`${inputId}-empty`} className="text-muted-foreground text-xs">
          {emptyText}
        </p>
      ) : null}
    </div>
  );
}

export function SuggestionMultiSelect({
  emptyText,
  inputId,
  label,
  labelClassName,
  onChange,
  options,
  placeholder,
  values,
}: Readonly<SuggestionMultiSelectProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const normalizedValues = useMemo(
    () =>
      [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0))].sort((left, right) => left - right),
    [values],
  );
  const incomingOptions = useMemo(() => toSortedUniqueOptions(options), [options]);
  const [knownOptions, setKnownOptions] = useState(() => toSortedUniqueOptions(options));

  useEffect(() => {
    setKnownOptions((currentOptions) => {
      const currentOptionsByValue = new Map(currentOptions.map((option) => [option.value, option]));
      const selectedOptions = normalizedValues.map((value) => {
        const matchedOption = incomingOptions.find((option) => option.value === value);

        return matchedOption ?? currentOptionsByValue.get(value) ?? { label: `${value}`, value };
      });

      return toSortedUniqueOptions([...currentOptions, ...incomingOptions, ...selectedOptions]);
    });
  }, [incomingOptions, normalizedValues]);

  const normalizedOptions = useMemo(() => toSortedUniqueOptions(knownOptions), [knownOptions]);
  const selectedValues = new Set(normalizedValues);
  const selectedLabels = normalizedValues.map(
    (value) => normalizedOptions.find((option) => option.value === value)?.label ?? `${value}`,
  );

  function toggleValue(value: number) {
    if (!Number.isInteger(value) || value < 0) {
      return;
    }

    if (selectedValues.has(value)) {
      onChange(normalizedValues.filter((item) => item !== value));
      setSearchValue("");
      return;
    }

    onChange([...normalizedValues, value]);
    setSearchValue("");
  }

  const triggerLabel =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`;

  const hasSuggestions = normalizedOptions.length > 0;

  function clearValues() {
    onChange([]);
  }

  return (
    <div className="space-y-2">
      <label className={cn("font-medium text-sm", labelClassName)} htmlFor={inputId}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Popover
          open={isOpen}
          onOpenChange={(nextOpen) => {
            setIsOpen(nextOpen);

            if (!nextOpen) {
              setSearchValue("");
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              id={inputId}
              type="button"
              variant="outline"
              className="h-9 flex-1 justify-between overflow-hidden font-normal"
            >
              <span
                className={cn("min-w-0 truncate text-left", normalizedValues.length === 0 && "text-muted-foreground")}
              >
                {triggerLabel}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
            <Command>
              <CommandInput placeholder={placeholder} value={searchValue} onValueChange={setSearchValue} />
              <CommandList className="max-h-72">
                <CommandEmpty>{emptyText}</CommandEmpty>
                {normalizedOptions.map((option) => {
                  const selected = selectedValues.has(option.value);

                  return (
                    <CommandItem
                      key={`${inputId}-option-${option.value}`}
                      data-checked={selected}
                      value={option.label}
                      onMouseDown={(event) => event.preventDefault()}
                      onSelect={() => {
                        toggleValue(option.value);
                        window.requestAnimationFrame(() => {
                          setSearchValue("");
                          setIsOpen(true);
                        });
                      }}
                    >
                      <span className="flex-1 truncate">{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {normalizedValues.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`${placeholder}: ${label}`}
            onClick={clearValues}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
      {!hasSuggestions ? <p className="text-muted-foreground text-xs">{emptyText}</p> : null}
    </div>
  );
}

export function DateTimeRangePicker({
  clearLabel,
  fromLabel,
  fromValue,
  label,
  onChange,
  untilLabel,
  untilValue,
}: Readonly<DateTimeRangePickerProps>) {
  const fromDate = parseDatetimeLocalValue(fromValue);
  const untilDate = parseDatetimeLocalValue(untilValue);
  const hasRange = Boolean(fromDate || untilDate);
  const selectedRange: DateRange | undefined =
    fromDate || untilDate
      ? {
          from: fromDate,
          to: untilDate,
        }
      : undefined;
  const triggerValue =
    fromDate && untilDate
      ? `${formatDatetimeLabel(fromValue)} - ${formatDatetimeLabel(untilValue)}`
      : fromDate
        ? formatDatetimeLabel(fromValue)
        : untilDate
          ? formatDatetimeLabel(untilValue)
          : label;

  function handleRangeChange(nextRange: DateRange | undefined) {
    onChange({
      from: nextRange?.from
        ? toDatetimeLocalValue(applyTime(nextRange.from, getTimeInputValue(fromValue, "00:00")))
        : "",
      until: nextRange?.to ? toDatetimeLocalValue(applyTime(nextRange.to, getTimeInputValue(untilValue, "23:59"))) : "",
    });
  }

  function handleBoundaryTimeChange(boundary: "from" | "until", timeValue: string) {
    if (boundary === "from") {
      if (!fromDate) {
        return;
      }

      onChange({
        from: toDatetimeLocalValue(applyTime(fromDate, timeValue)),
        until: untilValue,
      });
      return;
    }

    if (!untilDate) {
      return;
    }

    onChange({
      from: fromValue,
      until: toDatetimeLocalValue(applyTime(untilDate, timeValue)),
    });
  }

  function clearBoundary(boundary: "from" | "until") {
    onChange({
      from: boundary === "from" ? "" : fromValue,
      until: boundary === "until" ? "" : untilValue,
    });
  }

  return (
    <div>
      <p className="font-medium text-sm">{label}</p>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-9 flex-1 justify-between overflow-hidden font-normal">
              <span className={cn("min-w-0 truncate text-left", !hasRange && "text-muted-foreground")}>
                {triggerValue}
              </span>
              <CalendarIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] gap-0 p-0" align="start">
            <Calendar
              mode="range"
              captionLayout="dropdown"
              defaultMonth={fromDate ?? untilDate}
              selected={selectedRange}
              onSelect={handleRangeChange}
              numberOfMonths={2}
            />
            <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{fromLabel}</p>
                  {fromValue ? (
                    <Button type="button" variant="ghost" size="xs" onClick={() => clearBoundary("from")}>
                      {clearLabel}
                    </Button>
                  ) : null}
                </div>
                <Input
                  type="time"
                  step={60}
                  value={getTimeInputValue(fromValue, "00:00")}
                  disabled={!fromDate}
                  onChange={(event) => handleBoundaryTimeChange("from", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{untilLabel}</p>
                  {untilValue ? (
                    <Button type="button" variant="ghost" size="xs" onClick={() => clearBoundary("until")}>
                      {clearLabel}
                    </Button>
                  ) : null}
                </div>
                <Input
                  type="time"
                  step={60}
                  value={getTimeInputValue(untilValue, "23:59")}
                  disabled={!untilDate}
                  onChange={(event) => handleBoundaryTimeChange("until", event.target.value)}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {hasRange ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={clearLabel}
            onClick={() =>
              onChange({
                from: "",
                until: "",
              })
            }
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
