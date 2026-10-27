export type CareLogType = "cry" | "feed" | "diaper" | "sleep" | "medication";

/** Display-only legacy timestamps are retained; only occurredAt establishes a date. */
export interface CareLogItem {
  id: string;
  type: CareLogType;
  title: string;
  detail: string;
  timestamp: string;
  minutesAgo: number;
  occurredAt?: string;
  amountMl?: number;
  durationMinutes?: number;
  confidence?: number;
  resolved?: boolean;
}

export interface CareDaySummary {
  day: string;
  totalCount: number;
  feedCount: number;
  totalFeedMl: number;
  unknownFeedCount: number;
  diaperCount: number;
  sleepCount: number;
  totalSleepMinutes: number;
  unknownSleepCount: number;
  formattedSleepDuration: string;
  cryCount: number;
  settledCryCount: number;
  medicationCount: number;
  undatedCount: number;
  invalidCount: number;
  futureCount: number;
  otherDayCount: number;
  duplicateCount: number;
  reportText: string;
}

const careTypes: readonly CareLogType[] = ["cry", "feed", "diaper", "sleep", "medication"];

export function isCareLogItem(value: unknown): value is CareLogItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    careTypes.includes(item.type as CareLogType) &&
    typeof item.title === "string" &&
    typeof item.detail === "string" &&
    typeof item.timestamp === "string" &&
    typeof item.minutesAgo === "number" &&
    Number.isFinite(item.minutesAgo) &&
    item.minutesAgo >= 0 &&
    (item.occurredAt === undefined || typeof item.occurredAt === "string") &&
    (item.amountMl === undefined || typeof item.amountMl === "number") &&
    (item.durationMinutes === undefined || typeof item.durationMinutes === "number") &&
    (item.confidence === undefined || typeof item.confidence === "number") &&
    (item.resolved === undefined || typeof item.resolved === "boolean")
  );
}

function validDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

export function localCareDay(time: number | Date = Date.now()): string {
  const date = time instanceof Date ? time : new Date(time);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid care record date");
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function recordedTime(value: unknown): number | null {
  // Require an offset. Date.parse alone accepts ambiguous local times and normalized invalid days.
  if (typeof value !== "string") return null;
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match || !validDay(match[1])) return null;
  if (
    Number(match[2]) > 23 ||
    Number(match[3]) > 59 ||
    Number(match[4]) > 59 ||
    Number(match[5] ?? 0) > 23 ||
    Number(match[6] ?? 0) > 59
  )
    return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function recordedNumber(value: unknown, maximum: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum
    ? value
    : null;
}

function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round((minutes - hours * 60) * 100) / 100;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}

/** No inference from free text, relative-age labels, IDs, or the time a backup was restored. */
export function summariseCareDay(
  records: readonly unknown[],
  day = localCareDay(),
  now: number = Date.now(),
): CareDaySummary {
  if (!validDay(day) || !Number.isFinite(new Date(now).getTime())) {
    throw new RangeError("Choose a valid care-summary day and reference time");
  }
  const summary: CareDaySummary = {
    day,
    totalCount: 0,
    feedCount: 0,
    totalFeedMl: 0,
    unknownFeedCount: 0,
    diaperCount: 0,
    sleepCount: 0,
    totalSleepMinutes: 0,
    unknownSleepCount: 0,
    formattedSleepDuration: "0m",
    cryCount: 0,
    settledCryCount: 0,
    medicationCount: 0,
    undatedCount: 0,
    invalidCount: 0,
    futureCount: 0,
    otherDayCount: 0,
    duplicateCount: 0,
    reportText: "",
  };
  const seen = new Set<string>();
  for (const value of records) {
    if (!isCareLogItem(value)) {
      summary.invalidCount += 1;
      continue;
    }
    const at = recordedTime(value.occurredAt);
    if (at === null) {
      if (value.occurredAt === undefined) summary.undatedCount += 1;
      else summary.invalidCount += 1;
      continue;
    }
    if (at > now) {
      summary.futureCount += 1;
      continue;
    }
    if (localCareDay(at) !== day) {
      summary.otherDayCount += 1;
      continue;
    }
    if (seen.has(value.id)) {
      summary.duplicateCount += 1;
      continue;
    }
    seen.add(value.id);
    summary.totalCount += 1;
    switch (value.type) {
      case "feed": {
        summary.feedCount += 1;
        const amount = recordedNumber(value.amountMl, 10_000);
        if (amount === null) summary.unknownFeedCount += 1;
        else summary.totalFeedMl += amount;
        break;
      }
      case "sleep": {
        summary.sleepCount += 1;
        const minutes = recordedNumber(value.durationMinutes, 24 * 60);
        if (minutes === null) summary.unknownSleepCount += 1;
        else summary.totalSleepMinutes += minutes;
        break;
      }
      case "diaper":
        summary.diaperCount += 1;
        break;
      case "cry":
        summary.cryCount += 1;
        if (value.resolved === true) summary.settledCryCount += 1;
        break;
      case "medication":
        summary.medicationCount += 1;
        break;
    }
  }
  summary.totalFeedMl = Math.round(summary.totalFeedMl * 100) / 100;
  summary.totalSleepMinutes = Math.round(summary.totalSleepMinutes * 100) / 100;
  summary.formattedSleepDuration = durationText(summary.totalSleepMinutes);
  summary.reportText = caregiverHandoffText(summary);
  return summary;
}

/** Shares recorded facts only; it does not recommend feeding, sleep, or medication actions. */
export function caregiverHandoffText(summary: CareDaySummary): string {
  const facts = [
    `Care records for ${summary.day} (local day)`,
    `${summary.feedCount} feeding entries; ${summary.totalFeedMl} ml explicitly recorded${summary.unknownFeedCount ? `; quantity not recorded for ${summary.unknownFeedCount}` : ""}.`,
    `${summary.diaperCount} diaper entries.`,
    `${summary.sleepCount} sleep entries; ${summary.formattedSleepDuration} explicitly recorded${summary.unknownSleepCount ? `; duration not recorded for ${summary.unknownSleepCount}` : ""}.`,
    `${summary.cryCount} cry entries; ${summary.settledCryCount} marked settled.`,
    `${summary.medicationCount} medication entries.`,
  ];
  if (summary.undatedCount)
    facts.push(`${summary.undatedCount} older undated entries excluded from daily totals.`);
  if (summary.futureCount || summary.invalidCount) {
    facts.push(
      `${summary.futureCount} future and ${summary.invalidCount} invalid entries excluded from daily totals.`,
    );
  }
  if (summary.duplicateCount)
    facts.push(`${summary.duplicateCount} duplicate entries excluded from daily totals.`);
  return facts.join("\n");
}
