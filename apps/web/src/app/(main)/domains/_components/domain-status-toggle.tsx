import { StatusToggle } from "@/components/yapd/status-toggle";

type DomainStatusToggleProps = {
  activeLabel: string;
  checked: boolean;
  disabled?: boolean;
  inactiveLabel: string;
  onCheckedChange: (checked: boolean) => void;
};

export function DomainStatusToggle({
  activeLabel,
  checked,
  disabled = false,
  inactiveLabel,
  onCheckedChange,
}: Readonly<DomainStatusToggleProps>) {
  return (
    <StatusToggle
      activeLabel={activeLabel}
      checked={checked}
      disabled={disabled}
      inactiveLabel={inactiveLabel}
      onCheckedChange={onCheckedChange}
    />
  );
}
