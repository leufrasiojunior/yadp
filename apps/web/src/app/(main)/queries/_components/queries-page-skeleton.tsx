import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function QueriesPageSkeleton() {
  const filterKeys = Array.from({ length: 8 }, (_value, index) => `filter-${index}`);
  const headerKeys = Array.from({ length: 7 }, (_value, index) => `header-${index}`);
  const rowKeys = Array.from({ length: 10 }, (_value, index) => `row-${index}`);
  const columnKeys = Array.from({ length: 7 }, (_value, index) => `column-${index}`);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {filterKeys.map((key) => (
              <div key={key} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[1.3fr_1fr_0.4fr_0.7fr_1.8fr_1.2fr_0.9fr] gap-2">
            {headerKeys.map((key) => (
              <Skeleton key={key} className="h-4 w-full" />
            ))}
          </div>
          {rowKeys.map((rowKey) => (
            <div key={rowKey} className="grid grid-cols-[1.3fr_1fr_0.4fr_0.7fr_1.8fr_1.2fr_0.9fr] gap-2">
              {columnKeys.map((columnKey) => (
                <Skeleton key={`${rowKey}-${columnKey}`} className="h-10 w-full" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
