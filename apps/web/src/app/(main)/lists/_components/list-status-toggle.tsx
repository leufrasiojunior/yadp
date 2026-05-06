import { StatusToggle } from "@/components/yapd/status-toggle";

type ListStatusToggleProps = {
  activeLabel: string;
  checked: boolean;
  disabled?: boolean;
  inactiveLabel: string;
  onCheckedChange: (checked: boolean) => void;
};

export function ListStatusToggle({
  activeLabel,
  checked,
  disabled = false,
  inactiveLabel,
  onCheckedChange,
}: Readonly<ListStatusToggleProps>) {
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
