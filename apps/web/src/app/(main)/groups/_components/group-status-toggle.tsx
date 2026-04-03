import { StatusToggle } from "@/components/yapd/status-toggle";

type GroupStatusToggleProps = {
  activeLabel: string;
  checked: boolean;
  disabled?: boolean;
  inactiveLabel: string;
  onCheckedChange: (checked: boolean) => void;
};

export function GroupStatusToggle({
  activeLabel,
  checked,
  disabled = false,
  inactiveLabel,
  onCheckedChange,
}: Readonly<GroupStatusToggleProps>) {
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
