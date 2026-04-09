import { Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { DomainsService } from "../domains/domains.service";
import { DOMAIN_FILTER_VALUES } from "../domains/domains.types";
import { GroupsService } from "../groups/groups.service";
import { ListsService } from "../lists/lists.service";
import type { NavigationSummaryResponse } from "./navigation.types";

@Injectable()
export class NavigationService {
  constructor(
    @Inject(GroupsService) private readonly groupsService: GroupsService,
    @Inject(ListsService) private readonly listsService: ListsService,
    @Inject(DomainsService) private readonly domainsService: DomainsService,
  ) {}

  async getSummary(request: Request): Promise<NavigationSummaryResponse> {
    const [groups, lists, domains] = await Promise.all([
      this.groupsService.listGroups(request),
      this.listsService.listLists(
        {
          page: 1,
          pageSize: 1,
          sortBy: "address",
          sortDirection: "asc",
          search: "",
        },
        request,
      ),
      this.domainsService.listDomains(
        {
          page: 1,
          pageSize: 1,
          sortBy: "domain",
          sortDirection: "asc",
          search: "",
          filters: [...DOMAIN_FILTER_VALUES],
        },
        request,
      ),
    ]);

    return {
      groups: {
        total: groups.summary.totalItems,
      },
      lists: {
        total: lists.summary.totalItems,
      },
      domains: {
        total: domains.summary.totalItems,
      },
    };
  }
}
