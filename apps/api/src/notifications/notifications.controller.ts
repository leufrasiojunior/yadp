import { Body, Controller, Delete, Get, Inject, Param, Patch, Put, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";

import { CsrfGuard } from "../session/csrf.guard";
import { SessionGuard } from "../session/session.guard";
import type { DeletePushSubscriptionDto } from "./dto/delete-push-subscription.dto";
import type { GetNotificationsDto } from "./dto/get-notifications.dto";
import type { GetNotificationsPreviewDto } from "./dto/get-notifications-preview.dto";
import type { NotificationIdParamsDto } from "./dto/notification-id-params.dto";
import type { UpsertPushSubscriptionDto } from "./dto/upsert-push-subscription.dto";
import {
  NOTIFICATION_MUTATION_API_OK_RESPONSE,
  NOTIFICATION_READ_ALL_API_OK_RESPONSE,
  NOTIFICATIONS_LIST_API_OK_RESPONSE,
  NOTIFICATIONS_PREVIEW_API_OK_RESPONSE,
  PUSH_PUBLIC_KEY_API_OK_RESPONSE,
  PUSH_SUBSCRIPTION_API_OK_RESPONSE,
} from "./notifications.responses";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOkResponse(NOTIFICATIONS_LIST_API_OK_RESPONSE)
  listNotifications(@Query() query: GetNotificationsDto) {
    return this.notificationsService.listNotifications(query);
  }

  @Get("preview")
  @ApiOkResponse(NOTIFICATIONS_PREVIEW_API_OK_RESPONSE)
  getPreview(@Query() query: GetNotificationsPreviewDto) {
    return this.notificationsService.getPreview(query);
  }

  @Patch(":id/read")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(NOTIFICATION_MUTATION_API_OK_RESPONSE)
  markAsRead(@Param() params: NotificationIdParamsDto) {
    return this.notificationsService.markAsRead(params.id);
  }

  @Patch("read-all")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(NOTIFICATION_READ_ALL_API_OK_RESPONSE)
  markAllAsRead() {
    return this.notificationsService.markAllAsRead();
  }

  @Delete(":id")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(NOTIFICATION_MUTATION_API_OK_RESPONSE)
  hideNotification(@Param() params: NotificationIdParamsDto) {
    return this.notificationsService.hideNotification(params.id);
  }

  @Get("push/public-key")
  @ApiOkResponse(PUSH_PUBLIC_KEY_API_OK_RESPONSE)
  getPushPublicKey() {
    return this.notificationsService.getPushPublicKey();
  }

  @Put("push/subscription")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(PUSH_SUBSCRIPTION_API_OK_RESPONSE)
  upsertPushSubscription(@Body() body: UpsertPushSubscriptionDto) {
    return this.notificationsService.upsertPushSubscription(body);
  }

  @Delete("push/subscription")
  @UseGuards(CsrfGuard)
  @ApiOkResponse(PUSH_SUBSCRIPTION_API_OK_RESPONSE)
  deletePushSubscription(@Query() query: DeletePushSubscriptionDto) {
    return this.notificationsService.deletePushSubscription(query.endpoint ?? null);
  }
}
