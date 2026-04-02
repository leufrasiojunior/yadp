"use client";

import { Skeleton } from "@/components/ui/skeleton";

const QUERY_TABLE_HEADER_SKELETON_KEYS = Array.from({ length: 7 }, (_value, index) => `query-header-${index}`);
const QUERY_TABLE_ROW_SKELETON_KEYS = Array.from({ length: 12 }, (_value, index) => `query-row-${index}`);
const QUERY_TABLE_COLUMN_SKELETON_KEYS = Array.from({ length: 7 }, (_value, index) => `query-column-${index}`);

export function QueriesTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1.3fr_1fr_0.4fr_0.7fr_1.8fr_1.2fr_0.9fr] gap-2">
        {QUERY_TABLE_HEADER_SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-4 w-full" />
        ))}
      </div>
      {QUERY_TABLE_ROW_SKELETON_KEYS.map((rowKey) => (
        <div key={rowKey} className="grid grid-cols-[1.3fr_1fr_0.4fr_0.7fr_1.8fr_1.2fr_0.9fr] gap-2">
          {QUERY_TABLE_COLUMN_SKELETON_KEYS.map((columnKey) => (
            <Skeleton key={`${rowKey}-${columnKey}`} className="h-11 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
