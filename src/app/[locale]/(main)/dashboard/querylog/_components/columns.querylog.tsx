import { ColumnDef } from "@tanstack/react-table";
import { Clock, EllipsisVertical, Forward, History, RefreshCcw, ShieldOff, ShieldX } from "lucide-react";
import z from "zod";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatReplyTime, safeFormatUnixTime } from "@/lib/helpers";

import { recentQueryLogSchema } from "./schema";

export const recentQueryLogColumns: ColumnDef<z.infer<typeof recentQueryLogSchema>>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "time",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Data" className="justify-center" />,
    cell: ({ row }) => (
      <div className="text-center">
        <span className="tabular-nums">{safeFormatUnixTime(row.original.time, "dd/MM/yyyy HH:mm:ss")}</span>
      </div>
    ),
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" className="justify-center" />,
    cell: ({ row }) => {
      const status = row.original.status as string;
      const statusConfig: {
        [key: string]: { icon: React.ElementType; className: string; title: string };
      } = {
        CACHE: { icon: History, className: "text-sky-500", title: "Cache" },
        CACHE_STALE: { icon: Clock, className: "text-yellow-500", title: "Cache Stale" },
        DENYLIST: { icon: ShieldOff, className: "text-red-500", title: "Denylist" },
        FORWARDED: { icon: Forward, className: "text-blue-500", title: "Forwarded" },
        GRAVITY: { icon: ShieldX, className: "text-orange-500", title: "Gravity" },
        IN_PROGRESS: { icon: RefreshCcw, className: "text-black-500", title: "In Progress" },
      };

      const config = statusConfig[status];

      if (!config) {
        return <span>{status}</span>;
      }

      const Icon = config.icon;

      return (
        <div className="flex items-center justify-center" title={config.title}>
          <Icon className={`h-4 w-4 ${config.className}`} />
          <span className="sr-only">{config.title}</span>
        </div>
      );
    },
    enableHiding: true,
  },
  {
    accessorKey: "type",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" className="text-center" />,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Badge>{row.original.type}</Badge>
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "domain",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Domain" className="justify-center text-center" />
    ),
    cell: ({ row }) => <div className="text-center">{row.original.domain}</div>,
    enableSorting: false,
  },
  {
    accessorKey: "reply",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reply Time" className="justify-center text-center" />
    ),
    cell: ({ row }) => <div className="text-center">{formatReplyTime(row.original.reply.time)}</div>,
    enableSorting: false,
  },
  {
    accessorKey: "client",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Client" className="justify-center text-center" />
    ),
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Badge variant="secondary">{row.original.client?.name ?? row.original.client?.ip ?? "Unknown"}</Badge>
      </div>
    ),
    enableSorting: false,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Button className="w-4/5 p-4" onClick={() => alert(`Action on row ${row.id}`)}>
          Deny
        </Button>
      </div>
    ),
    enableSorting: false,
  },
];
