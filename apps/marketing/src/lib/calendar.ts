import dayjs from "dayjs";
import { loadCalendar, loadCalendarRaw } from "./config.js";
import { contentExists, findContentById } from "./content-store.js";
import type { CalendarEntry, Channel } from "../types/index.js";

export function getCurrentWeek(): string {
  // Find which sequential week the current date falls into
  const raw = loadCalendarRaw();
  const today = dayjs();

  for (let i = 0; i < raw.length; i++) {
    const weekStart = dayjs(raw[i].start_date);
    const weekEnd = i < raw.length - 1 ? dayjs(raw[i + 1].start_date) : weekStart.add(7, "day");

    if (today.isBefore(weekEnd) && !today.isBefore(weekStart)) {
      return raw[i].week;
    }
  }

  // If before all weeks, return first; if after all, return last
  if (raw.length > 0) {
    const firstStart = dayjs(raw[0].start_date);
    if (today.isBefore(firstStart)) return raw[0].week;
    return raw[raw.length - 1].week;
  }

  return "week-1";
}

export function getCalendarEntries(filter?: {
  week?: string;
  channel?: Channel;
  month?: string;
}): CalendarEntry[] {
  let entries = loadCalendar();

  if (filter?.week) {
    entries = entries.filter((e) => e.week === filter.week);
  }
  if (filter?.channel) {
    entries = entries.filter((e) => e.channel === filter.channel);
  }
  if (filter?.month) {
    const month = filter.month;
    entries = entries.filter((e) => e.scheduled_for.startsWith(month));
  }

  return entries;
}

export interface CalendarEntryWithStatus extends CalendarEntry {
  content_status: "not_generated" | "draft" | "approved" | "published" | "rejected";
  content_id: string;
}

export function getCalendarWithStatus(filter?: {
  week?: string;
  channel?: Channel;
  month?: string;
}): CalendarEntryWithStatus[] {
  const entries = getCalendarEntries(filter);

  return entries.map((entry) => {
    const id = generateContentId(entry);
    let content_status: CalendarEntryWithStatus["content_status"] = "not_generated";

    if (contentExists(id)) {
      const found = findContentById(id);
      if (found) content_status = found.frontmatter.status;
    }

    return { ...entry, content_status, content_id: id };
  });
}

export function getDueEntries(options?: {
  channel?: Channel;
  week?: string;
}): CalendarEntry[] {
  const week = options?.week ?? getCurrentWeek();
  const entries = getCalendarEntries({ week, channel: options?.channel });

  // Filter out entries that already have content generated
  return entries.filter((entry) => {
    const id = generateContentId(entry);
    return !contentExists(id);
  });
}

export function generateContentId(entry: CalendarEntry): string {
  const date = dayjs(entry.scheduled_for).format("YYYY-MM-DD");
  const slug = entry.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${date}-${entry.channel}-${slug}`;
}
