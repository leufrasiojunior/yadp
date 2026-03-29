const DASHBOARD_HOUR_WINDOW_DURATION_MS = 50 * 60 * 1000;

export function formatDashboardHourTick(timestamp: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatDashboardHourRange(timestamp: string, locale: string) {
  const start = new Date(timestamp);
  const end = new Date(start.getTime() + DASHBOARD_HOUR_WINDOW_DURATION_MS);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const startDate = dateFormatter.format(start);
  const endDate = dateFormatter.format(end);
  const startTime = timeFormatter.format(start);
  const endTime = timeFormatter.format(end);

  if (startDate === endDate) {
    return `${startDate}, ${startTime} - ${endTime}`;
  }

  return `${startDate}, ${startTime} - ${endDate}, ${endTime}`;
}
