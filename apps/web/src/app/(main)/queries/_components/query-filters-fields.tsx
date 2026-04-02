"use client";

import { ChevronDown } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const EMPTY_SELECT_VALUE = "__any__";

type SuggestionInputProps = {
  inputId: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions: string[];
  value: string;
};

type SuggestionSelectInputProps = {
  inputId: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  value: string;
};

export function SuggestionInput({
  inputId,
  label,
  onChange,
  placeholder,
  suggestions,
  value,
}: Readonly<SuggestionInputProps>) {
  return (
    <div className="space-y-2">
      <label className="font-medium text-sm" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative">
        <Input
          id={inputId}
          list={`${inputId}-list`}
          value={value}
          className="appearance-none pr-9 [&::-webkit-calendar-picker-indicator]:hidden"
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        <ChevronDown className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 size-4 text-muted-foreground" />
      </div>
      <datalist id={`${inputId}-list`}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </div>
  );
}

export function SuggestionSelectInput({
  inputId,
  label,
  onChange,
  placeholder,
  suggestions,
  value,
}: Readonly<SuggestionSelectInputProps>) {
  return (
    <div className="space-y-2">
      <label className="font-medium text-sm" htmlFor={inputId}>
        {label}
      </label>
      <Select
        value={value || EMPTY_SELECT_VALUE}
        onValueChange={(nextValue) => onChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)}
      >
        <SelectTrigger id={inputId} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_SELECT_VALUE}>{placeholder}</SelectItem>
          {suggestions.map((suggestion) => (
            <SelectItem key={suggestion} value={suggestion}>
              {suggestion}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
