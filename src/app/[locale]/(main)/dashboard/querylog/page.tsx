import { table } from "console";

import React from "react";

import { Download } from "lucide-react";

import { DataTableNew } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from "@/components/ui/card";
import { useAggregatedPiholeQuery } from "@/hooks/use-aggregated-pihole-query";
import { useDataTableInstance } from "@/hooks/use-data-table-instance";
import { Client, Ede, QueryTableResponse, Reply } from "@/types/history-table";

import { recentLeadsColumns } from "../crm/_components/columns.crm";

import { recentQueryLogColumns } from "./_components/columns.querylog";

type QueryResponse = {
  id: number;
  time: number;
  type: string;
  status: string;
  dnssec: string;
  domain: string;
  upstream?: string;
  reply: Reply;
  client: Client;
  list_id?: number;
  ede: Ede;
  cname: any;
}[];

const historyAggregator = (results: QueryTableResponse[]): QueryResponse => {
  return [];
};
const initialData: QueryResponse = [];

function QuerylogPage() {
  const piholeEndpoint = `queries`;

  const { data: queries, loading } = useAggregatedPiholeQuery<QueryTableResponse, QueryResponse>(
    piholeEndpoint,
    historyAggregator,
    initialData,
    // 2000,
  );

  const table = useDataTableInstance({
    data: queries,
    columns: recentQueryLogColumns,
    getRowId: (row) => row.id.toString(),
  });
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
          <CardDescription>Track and manage your latest leads and their status.</CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <DataTableViewOptions table={table} />
              <Button variant="outline" size="sm">
                <Download />
                <span className="hidden lg:inline">Export</span>
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex size-full flex-col gap-4">
          <div className="overflow-hidden rounded-md border">
            <DataTableNew table={table} columns={recentLeadsColumns} />
          </div>
          <DataTablePagination table={table} />
        </CardContent>
      </Card>
    </div>
  );
}

export default QuerylogPage;
