import { Injectable, Logger } from "@nestjs/common";

export type AppConfigTimeZoneChangedEvent = {
  previousTimeZone: string;
  timeZone: string;
};

type TimeZoneChangedListener = (event: AppConfigTimeZoneChangedEvent) => Promise<void> | void;

@Injectable()
export class AppConfigEventsService {
  private readonly logger = new Logger(AppConfigEventsService.name);
  private readonly timeZoneChangedListeners = new Set<TimeZoneChangedListener>();

  onTimeZoneChanged(listener: TimeZoneChangedListener) {
    this.timeZoneChangedListeners.add(listener);

    return () => {
      this.timeZoneChangedListeners.delete(listener);
    };
  }

  async notifyTimeZoneChanged(event: AppConfigTimeZoneChangedEvent) {
    for (const listener of this.timeZoneChangedListeners) {
      try {
        await listener(event);
      } catch (error) {
        this.logger.error(`Could not notify app timezone listener: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
}
