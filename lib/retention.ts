/** How long each kind of data is kept, in months: the privacy page says so, the cleanup cron does it. */
export const RETENTION_MONTHS = { events: 12, photoLogs: 12, feedback: 24 } as const;
