import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { recentQueryLogColumns } from "./columns.querylog";

export default function TableSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <div>
            <Skeleton className="h-6 w-[250px]" />
            <Skeleton className="mt-2 h-4 w-[450px]" />
          </div>
          <CardAction>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-[120px]" />
              <Skeleton className="h-9 w-[90px]" />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex size-full flex-col gap-4">
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {Array.from({ length: recentQueryLogColumns.length }).map((_, index) => (
                    <TableHead key={index} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 10 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {Array.from({ length: recentQueryLogColumns.length }).map((_, cellIndex) => (
                      <TableCell key={cellIndex} className="px-4 py-4">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-[150px]" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
