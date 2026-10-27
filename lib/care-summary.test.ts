import assert from "node:assert/strict";
import test from "node:test";
import {
  caregiverHandoffText,
  localCareDay,
  summariseCareDay,
  type CareLogItem,
} from "./care-summary.ts";

const now = new Date(2026, 9, 26, 12).getTime();
const day = localCareDay(now);
const at = new Date(2026, 9, 26, 10).toISOString();
function record(overrides: Partial<CareLogItem> = {}): CareLogItem {
  return {
    id: "record-1",
    type: "feed",
    title: "Feeding logged",
    detail: "Recorded by caregiver",
    timestamp: "10:00",
    minutesAgo: 120,
    occurredAt: at,
    ...overrides,
  };
}

test("daily totals include only records from the selected local calendar day", () => {
  const records = [
    record({ id: "today", amountMl: 100 }),
    record({
      id: "yesterday",
      occurredAt: new Date(2026, 9, 25, 23, 59).toISOString(),
      amountMl: 200,
    }),
    record({ id: "future", occurredAt: new Date(now + 60_000).toISOString(), amountMl: 300 }),
  ];
  const summary = summariseCareDay(records, day, now);
  assert.equal(summary.feedCount, 1);
  assert.equal(summary.totalFeedMl, 100);
  assert.equal(summary.otherDayCount, 1);
  assert.equal(summary.futureCount, 1);
});

test("local midnight boundary differs from UTC when the device timezone differs", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "Africa/Johannesburg";
    const reference = Date.parse("2026-10-26T02:00:00Z");
    const summary = summariseCareDay(
      [record({ occurredAt: "2026-10-25T22:30:00Z", amountMl: 75 })],
      "2026-10-26",
      reference,
    );
    assert.equal(summary.feedCount, 1);
    assert.equal(summary.totalFeedMl, 75);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("missing quantities and durations remain unknown even if free text contains numbers", () => {
  const summary = summariseCareDay(
    [
      record({ title: "Bottle feed 110 ml", detail: "Offered 120 ml, consumed amount unknown" }),
      record({ id: "sleep", type: "sleep", detail: "Possibly 45 minutes" }),
      record({ id: "known-sleep", type: "sleep", durationMinutes: 95 }),
      record({ id: "known-feed", amountMl: 90.5 }),
    ],
    day,
    now,
  );
  assert.equal(summary.totalFeedMl, 90.5);
  assert.equal(summary.unknownFeedCount, 1);
  assert.equal(summary.totalSleepMinutes, 95);
  assert.equal(summary.unknownSleepCount, 1);
  assert.equal(summary.formattedSleepDuration, "1h 35m");
  assert.match(summary.reportText, /quantity not recorded for 1/);
  assert.match(summary.reportText, /duration not recorded for 1/);
});

test("undated legacy records are preserved without assigning a date from minutesAgo", () => {
  const legacy = record({ occurredAt: undefined, id: `feed-${now}`, minutesAgo: 0 });
  const before = structuredClone(legacy);
  const summary = summariseCareDay([legacy], day, now);
  assert.equal(summary.feedCount, 0);
  assert.equal(summary.undatedCount, 1);
  assert.deepEqual(legacy, before);
});

test("invalid records, ambiguous dates and future records cannot enter totals", () => {
  const summary = summariseCareDay(
    [
      null,
      { id: "broken" },
      record({ id: "ambiguous", occurredAt: "2026-10-26T10:00:00" }),
      record({ id: "normalized", occurredAt: "2026-02-30T10:00:00Z" }),
      record({ id: "invalid-hour", occurredAt: "2026-10-25T24:00:00Z" }),
      record({ id: "invalid-amount", amountMl: "100" as unknown as number }),
      record({ id: "future", occurredAt: new Date(now + 1).toISOString() }),
    ],
    day,
    now,
  );
  assert.equal(summary.totalCount, 0);
  assert.equal(summary.invalidCount, 6);
  assert.equal(summary.futureCount, 1);
  assert.throws(() => summariseCareDay([], "2026-02-30", now), RangeError);
  assert.throws(() => summariseCareDay([], day, Infinity), RangeError);
});

test("invalid measurements remain unknown and repeated IDs do not double count", () => {
  const summary = summariseCareDay(
    [
      record({ amountMl: -1 }),
      record({ amountMl: 150 }),
      record({ id: "non-finite", amountMl: Infinity }),
      record({ id: "too-long", type: "sleep", durationMinutes: 1441 }),
      record({ id: "zero", amountMl: 0 }),
    ],
    day,
    now,
  );
  assert.equal(summary.feedCount, 3);
  assert.equal(summary.totalFeedMl, 0);
  assert.equal(summary.unknownFeedCount, 2);
  assert.equal(summary.unknownSleepCount, 1);
  assert.equal(summary.duplicateCount, 1);
});

test("handoff reports recorded entries without inferred medical or routine instructions", () => {
  const summary = summariseCareDay(
    [
      record({ id: "cry", type: "cry", resolved: true }),
      record({ id: "medication", type: "medication", detail: "Private note" }),
      record({ id: "diaper", type: "diaper" }),
    ],
    day,
    now,
  );
  const text = caregiverHandoffText(summary);
  assert.match(text, /1 cry entries; 1 marked settled/);
  assert.match(text, /1 medication entries/);
  assert.doesNotMatch(text, /Private note|next feed|should|dose|120 ml|45m/i);
  assert.equal(summary.totalCount, 3);
  assert.equal(summariseCareDay([], day, now).totalCount, 0);
});
