import { JSX } from "react";

import { Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";

type ToastType = "info" | "success" | "error" | "warning";

type ToastAction = {
  label: string;
  onClick: () => void;
};

export function showToast(type: ToastType, message: string, description?: string, action?: ToastAction) {
  const icons: Record<ToastType, JSX.Element> = {
    info: <Info className="h-5 w-5 text-blue-500" />,
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />,
  };

  const commonOptions = {
    description,
    icon: icons[type],
    id: `${type}-${Date.now()}`,
    duration: 10000,
    action,
  };

  switch (type) {
    case "info":
      toast.info(message, commonOptions);
      break;
    case "success":
      toast.success(message, commonOptions);
      break;
    case "warning":
      toast.warning(message, commonOptions);
      break;
    case "error":
      toast.error(message, commonOptions);
      break;
    default:
      toast(message, commonOptions);
  }
}
