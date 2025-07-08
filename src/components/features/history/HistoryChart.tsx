import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface HistoryEntry {
  timestamp: number;
  total: number;
  cached: number;
  blocked: number;
  forwarded: number;
}

interface HistoryChartProps {
  data: HistoryEntry[];
}

export function HistoryChart({ data }: HistoryChartProps) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.total));

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end space-x-2 h-40">
          {data.map((h) => {
            const blockedHeight = (h.blocked / max) * 100;
            const forwardedHeight = (h.forwarded / max) * 100;
            const cachedHeight = (h.cached / max) * 100;
            return (
              <div key={h.timestamp} className="flex flex-col-reverse w-6">
                <div
                  className="bg-[--chart-3] w-full"
                  style={{ height: `${cachedHeight}%` }}
                  title={`Cached: ${h.cached}`}
                />
                <div
                  className="bg-[--chart-2] w-full"
                  style={{ height: `${forwardedHeight}%` }}
                  title={`Forwarded: ${h.forwarded}`}
                />
                <div
                  className="bg-[--chart-1] w-full"
                  style={{ height: `${blockedHeight}%` }}
                  title={`Blocked: ${h.blocked}`}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
