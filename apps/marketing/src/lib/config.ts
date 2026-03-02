import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { CalendarWeek, CalendarEntry, ChannelConfig } from "../types/index.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

export function getProjectRoot(): string {
  return PROJECT_ROOT;
}

export function getConfigPath(filename: string): string {
  return path.join(PROJECT_ROOT, "config", filename);
}

export function getContentDir(subdir: string): string {
  return path.join(PROJECT_ROOT, "content", subdir);
}

export function getPromptsDir(): string {
  return path.join(PROJECT_ROOT, "prompts");
}

export function loadYamlConfig<T>(filename: string): T {
  const filepath = getConfigPath(filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Config file not found: ${filepath}`);
  }
  const raw = fs.readFileSync(filepath, "utf-8");
  return YAML.parse(raw) as T;
}

export function loadTextConfig(filename: string): string {
  const filepath = getConfigPath(filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Config file not found: ${filepath}`);
  }
  return fs.readFileSync(filepath, "utf-8");
}

export function loadChannelsConfig(): Record<string, ChannelConfig> {
  return loadYamlConfig<Record<string, ChannelConfig>>("channels.yaml");
}

export function loadCalendar(): CalendarEntry[] {
  const data = loadYamlConfig<{ weeks: CalendarWeek[] }>("content-calendar.yaml");
  const entries: CalendarEntry[] = [];

  for (const week of data.weeks) {
    for (const item of week.content) {
      entries.push({
        week: week.week,
        start_date: week.start_date,
        theme: week.theme,
        ...item,
      });
    }
  }

  return entries;
}

export function loadCalendarRaw(): CalendarWeek[] {
  const data = loadYamlConfig<{ weeks: CalendarWeek[] }>("content-calendar.yaml");
  return data.weeks;
}

export function loadKpis(): Record<string, Record<string, Record<string, number>>> {
  return loadYamlConfig("kpis.yaml");
}

export function loadBrandVoice(): string {
  return loadTextConfig("brand-voice.md");
}

export function loadProductContext(): string {
  return loadTextConfig("product-context.md");
}
