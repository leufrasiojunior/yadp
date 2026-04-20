import "reflect-metadata";

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { ValidationPipe } = require("@nestjs/common");

const { ClientsController } = require("../dist/clients/clients.controller.js");
const { GetClientsDto } = require("../dist/clients/dto/get-clients.dto.js");
const { SaveClientsDto } = require("../dist/clients/dto/save-clients.dto.js");
const { SyncClientsDto } = require("../dist/clients/dto/sync-clients.dto.js");
const { UpdateClientDto } = require("../dist/clients/dto/update-client.dto.js");
const { DashboardController } = require("../dist/dashboard/dashboard.controller.js");
const { GetDashboardOverviewDto } = require("../dist/dashboard/dto/get-dashboard-overview.dto.js");
const { DomainsController } = require("../dist/domains/domains.controller.js");
const { ApplyDomainOperationDto } = require("../dist/domains/dto/apply-domain-operation.dto.js");
const { BatchDeleteDomainsDto } = require("../dist/domains/dto/batch-delete-domains.dto.js");
const { DomainItemParamsDto } = require("../dist/domains/dto/domain-item-params.dto.js");
const { DomainOperationParamsDto } = require("../dist/domains/dto/domain-operation-params.dto.js");
const { GetDomainsDto } = require("../dist/domains/dto/get-domains.dto.js");
const { SyncDomainsDto } = require("../dist/domains/dto/sync-domains.dto.js");
const { UpdateDomainDto } = require("../dist/domains/dto/update-domain.dto.js");
const { GroupsController } = require("../dist/groups/groups.controller.js");
const { BatchDeleteGroupsDto } = require("../dist/groups/dto/batch-delete-groups.dto.js");
const { CreateGroupsDto } = require("../dist/groups/dto/create-groups.dto.js");
const { GroupNameParamsDto } = require("../dist/groups/dto/group-name-params.dto.js");
const { SyncGroupsDto } = require("../dist/groups/dto/sync-groups.dto.js");
const { UpdateGroupDto } = require("../dist/groups/dto/update-group.dto.js");
const { UpdateGroupStatusDto } = require("../dist/groups/dto/update-group-status.dto.js");
const { InstancesController } = require("../dist/instances/instances.controller.js");
const { CreateInstanceDto } = require("../dist/instances/dto/create-instance.dto.js");
const { DiscoverInstancesDto } = require("../dist/instances/dto/discover-instances.dto.js");
const { InstanceIdParamsDto } = require("../dist/instances/dto/instance-id-params.dto.js");
const { UpdateInstanceDto } = require("../dist/instances/dto/update-instance.dto.js");
const { UpdateInstanceSyncDto } = require("../dist/instances/dto/update-instance-sync.dto.js");
const { ListsController } = require("../dist/lists/lists.controller.js");
const { BatchDeleteListsDto } = require("../dist/lists/dto/batch-delete-lists.dto.js");
const { CreateListDto } = require("../dist/lists/dto/create-list.dto.js");
const { GetListsDto } = require("../dist/lists/dto/get-lists.dto.js");
const { ListItemParamsDto } = require("../dist/lists/dto/list-item-params.dto.js");
const { SyncListsDto } = require("../dist/lists/dto/sync-lists.dto.js");
const { UpdateListDto } = require("../dist/lists/dto/update-list.dto.js");
const { NotificationsController } = require("../dist/notifications/notifications.controller.js");
const { DeletePushSubscriptionDto } = require("../dist/notifications/dto/delete-push-subscription.dto.js");
const { GetNotificationsDto } = require("../dist/notifications/dto/get-notifications.dto.js");
const { GetNotificationsPreviewDto } = require("../dist/notifications/dto/get-notifications-preview.dto.js");
const { NotificationIdParamsDto } = require("../dist/notifications/dto/notification-id-params.dto.js");
const { UpsertPushSubscriptionDto } = require("../dist/notifications/dto/upsert-push-subscription.dto.js");
const { QueriesController } = require("../dist/queries/queries.controller.js");
const { GetQueriesDto } = require("../dist/queries/dto/get-queries.dto.js");
const { GetQuerySuggestionsDto } = require("../dist/queries/dto/get-query-suggestions.dto.js");
const { SessionController } = require("../dist/session/session.controller.js");
const { LoginDto } = require("../dist/session/dto/login.dto.js");
const { UpdateSessionPreferencesDto } = require("../dist/session/dto/update-session-preferences.dto.js");
const { SetupController } = require("../dist/setup/setup.controller.js");
const { CreateBaselineDto } = require("../dist/setup/dto/create-baseline.dto.js");
const { SyncController } = require("../dist/sync/sync.controller.js");
const { ApplyBlockingOperationDto } = require("../dist/sync/dto/apply-blocking-operation.dto.js");
const { PreviewBlockingOperationDto } = require("../dist/sync/dto/preview-blocking-operation.dto.js");
const { UpdateBlockingPresetsDto } = require("../dist/sync/dto/update-blocking-presets.dto.js");

const EXPECTATIONS = [
  { controller: ClientsController, method: "listClients", parameterIndex: 0, expectedType: GetClientsDto },
  { controller: ClientsController, method: "saveClients", parameterIndex: 0, expectedType: SaveClientsDto },
  { controller: ClientsController, method: "updateClient", parameterIndex: 1, expectedType: UpdateClientDto },
  { controller: ClientsController, method: "syncClients", parameterIndex: 0, expectedType: SyncClientsDto },
  { controller: DashboardController, method: "getOverview", parameterIndex: 0, expectedType: GetDashboardOverviewDto },
  { controller: DomainsController, method: "listDomains", parameterIndex: 0, expectedType: GetDomainsDto },
  { controller: DomainsController, method: "exportDomains", parameterIndex: 0, expectedType: GetDomainsDto },
  { controller: DomainsController, method: "getDomain", parameterIndex: 0, expectedType: DomainItemParamsDto },
  {
    controller: DomainsController,
    method: "applyDomainOperation",
    parameterIndex: 0,
    expectedType: DomainOperationParamsDto,
  },
  {
    controller: DomainsController,
    method: "applyDomainOperation",
    parameterIndex: 1,
    expectedType: ApplyDomainOperationDto,
  },
  { controller: DomainsController, method: "updateDomain", parameterIndex: 3, expectedType: UpdateDomainDto },
  { controller: DomainsController, method: "batchDelete", parameterIndex: 0, expectedType: BatchDeleteDomainsDto },
  { controller: DomainsController, method: "syncDomains", parameterIndex: 0, expectedType: SyncDomainsDto },
  { controller: GroupsController, method: "createGroups", parameterIndex: 0, expectedType: CreateGroupsDto },
  { controller: GroupsController, method: "updateGroup", parameterIndex: 0, expectedType: GroupNameParamsDto },
  { controller: GroupsController, method: "updateGroup", parameterIndex: 1, expectedType: UpdateGroupDto },
  { controller: GroupsController, method: "updateGroupStatus", parameterIndex: 0, expectedType: GroupNameParamsDto },
  { controller: GroupsController, method: "updateGroupStatus", parameterIndex: 1, expectedType: UpdateGroupStatusDto },
  { controller: GroupsController, method: "deleteGroup", parameterIndex: 0, expectedType: GroupNameParamsDto },
  { controller: GroupsController, method: "batchDeleteGroups", parameterIndex: 0, expectedType: BatchDeleteGroupsDto },
  { controller: GroupsController, method: "syncGroups", parameterIndex: 0, expectedType: SyncGroupsDto },
  { controller: InstancesController, method: "getInstance", parameterIndex: 0, expectedType: InstanceIdParamsDto },
  { controller: InstancesController, method: "getInstanceInfo", parameterIndex: 0, expectedType: InstanceIdParamsDto },
  {
    controller: InstancesController,
    method: "discoverInstances",
    parameterIndex: 0,
    expectedType: DiscoverInstancesDto,
  },
  { controller: InstancesController, method: "createInstance", parameterIndex: 0, expectedType: CreateInstanceDto },
  { controller: InstancesController, method: "testInstance", parameterIndex: 0, expectedType: InstanceIdParamsDto },
  {
    controller: InstancesController,
    method: "reauthenticateInstance",
    parameterIndex: 0,
    expectedType: InstanceIdParamsDto,
  },
  { controller: InstancesController, method: "updateInstance", parameterIndex: 0, expectedType: InstanceIdParamsDto },
  { controller: InstancesController, method: "updateInstance", parameterIndex: 1, expectedType: UpdateInstanceDto },
  {
    controller: InstancesController,
    method: "updateInstanceSync",
    parameterIndex: 0,
    expectedType: InstanceIdParamsDto,
  },
  {
    controller: InstancesController,
    method: "updateInstanceSync",
    parameterIndex: 1,
    expectedType: UpdateInstanceSyncDto,
  },
  { controller: ListsController, method: "listLists", parameterIndex: 0, expectedType: GetListsDto },
  { controller: ListsController, method: "getList", parameterIndex: 0, expectedType: ListItemParamsDto },
  { controller: ListsController, method: "createList", parameterIndex: 0, expectedType: CreateListDto },
  { controller: ListsController, method: "updateList", parameterIndex: 0, expectedType: ListItemParamsDto },
  { controller: ListsController, method: "updateList", parameterIndex: 1, expectedType: UpdateListDto },
  { controller: ListsController, method: "batchDelete", parameterIndex: 0, expectedType: BatchDeleteListsDto },
  { controller: ListsController, method: "syncLists", parameterIndex: 0, expectedType: SyncListsDto },
  {
    controller: NotificationsController,
    method: "listNotifications",
    parameterIndex: 0,
    expectedType: GetNotificationsDto,
  },
  {
    controller: NotificationsController,
    method: "getPreview",
    parameterIndex: 0,
    expectedType: GetNotificationsPreviewDto,
  },
  {
    controller: NotificationsController,
    method: "markAsRead",
    parameterIndex: 0,
    expectedType: NotificationIdParamsDto,
  },
  {
    controller: NotificationsController,
    method: "hideNotification",
    parameterIndex: 0,
    expectedType: NotificationIdParamsDto,
  },
  {
    controller: NotificationsController,
    method: "upsertPushSubscription",
    parameterIndex: 0,
    expectedType: UpsertPushSubscriptionDto,
  },
  {
    controller: NotificationsController,
    method: "deletePushSubscription",
    parameterIndex: 0,
    expectedType: DeletePushSubscriptionDto,
  },
  { controller: QueriesController, method: "getQueries", parameterIndex: 0, expectedType: GetQueriesDto },
  {
    controller: QueriesController,
    method: "getQuerySuggestions",
    parameterIndex: 0,
    expectedType: GetQuerySuggestionsDto,
  },
  { controller: SessionController, method: "login", parameterIndex: 0, expectedType: LoginDto },
  {
    controller: SessionController,
    method: "updatePreferences",
    parameterIndex: 0,
    expectedType: UpdateSessionPreferencesDto,
  },
  { controller: SetupController, method: "createBaseline", parameterIndex: 0, expectedType: CreateBaselineDto },
  {
    controller: SyncController,
    method: "updateBlockingPresets",
    parameterIndex: 0,
    expectedType: UpdateBlockingPresetsDto,
  },
  {
    controller: SyncController,
    method: "previewBlocking",
    parameterIndex: 0,
    expectedType: PreviewBlockingOperationDto,
  },
  { controller: SyncController, method: "applyBlocking", parameterIndex: 0, expectedType: ApplyBlockingOperationDto },
];

test("compiled controllers preserve runtime metadata for validated DTO parameters", () => {
  for (const expectation of EXPECTATIONS) {
    const metadata = Reflect.getMetadata("design:paramtypes", expectation.controller.prototype, expectation.method);

    assert.ok(
      metadata,
      `${expectation.controller.name}.${expectation.method} should expose design:paramtypes metadata in dist output`,
    );
    assert.equal(
      metadata[expectation.parameterIndex],
      expectation.expectedType,
      `${expectation.controller.name}.${expectation.method} parameter #${expectation.parameterIndex} should retain ${expectation.expectedType.name} at runtime`,
    );
  }
});

test("compiled query DTOs accept pagination and sorting fields under ValidationPipe", async () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  const clients = await pipe.transform(
    { page: "1", pageSize: "20", sortBy: "numQueries", sortDirection: "desc" },
    { type: "query", metatype: GetClientsDto },
  );
  assert.equal(clients.page, 1);
  assert.equal(clients.pageSize, 20);
  assert.equal(clients.sortBy, "numQueries");
  assert.equal(clients.sortDirection, "desc");

  const domains = await pipe.transform(
    { page: "1", pageSize: "20", sortBy: "domain", sortDirection: "asc" },
    { type: "query", metatype: GetDomainsDto },
  );
  assert.equal(domains.page, 1);
  assert.equal(domains.pageSize, 20);
  assert.equal(domains.sortBy, "domain");
  assert.equal(domains.sortDirection, "asc");

  const lists = await pipe.transform(
    { page: "1", pageSize: "20", sortBy: "address", sortDirection: "asc" },
    { type: "query", metatype: GetListsDto },
  );
  assert.equal(lists.page, 1);
  assert.equal(lists.pageSize, 20);
  assert.equal(lists.sortBy, "address");
  assert.equal(lists.sortDirection, "asc");
});
