"use client";

import { X } from "lucide-react";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

type ManagedItemsSearchInputProps = {
  clearLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
};

export function ManagedItemsSearchInput({
  clearLabel,
  disabled,
  onChange,
  placeholder,
  value,
}: Readonly<ManagedItemsSearchInputProps>) {
  return (
    <InputGroup className="min-w-56 border-input/60 bg-background/80 shadow-none">
      <InputGroupInput
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {value.length > 0 ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            aria-label={clearLabel}
            title={clearLabel}
            disabled={disabled}
            onClick={() => onChange("")}
          >
            <X className="pointer-events-none size-3.5" />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
