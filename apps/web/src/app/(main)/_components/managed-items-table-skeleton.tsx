"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

type ManagedItemsTableSkeletonProps = {
  columnCount: number;
  rowCount?: number;
};

const SKELETON_ROW_KEYS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"] as const;

const SKELETON_CELL_KEYS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"] as const;

export function ManagedItemsTableSkeleton({ columnCount, rowCount = 5 }: Readonly<ManagedItemsTableSkeletonProps>) {
  return SKELETON_ROW_KEYS.slice(0, rowCount).map((rowKey) => (
    <TableRow key={`managed-skeleton-row-${rowKey}`}>
      {SKELETON_CELL_KEYS.slice(0, columnCount).map((cellKey) => (
        <TableCell key={`managed-skeleton-cell-${rowKey}-${cellKey}`}>
          <Skeleton className="h-5 w-full max-w-36" />
        </TableCell>
      ))}
    </TableRow>
  ));
}
