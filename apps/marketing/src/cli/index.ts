#!/usr/bin/env tsx
import { Command } from "commander";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerReviewCommand } from "./commands/review.js";
import { registerPublishCommand } from "./commands/publish.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerCalendarCommand } from "./commands/calendar.js";
import { registerAnalyticsCommand } from "./commands/analytics.js";
import { registerReportCommand } from "./commands/report.js";
import { registerDashboardCommand } from "./commands/dashboard.js";

const program = new Command();

program
  .name("pincer")
  .description("PincerPay marketing automation CLI")
  .version("0.1.0");

registerGenerateCommand(program);
registerReviewCommand(program);
registerPublishCommand(program);
registerStatusCommand(program);
registerCalendarCommand(program);
registerAnalyticsCommand(program);
registerReportCommand(program);
registerDashboardCommand(program);

program.parse();
