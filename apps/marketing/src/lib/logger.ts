import chalk from "chalk";

export const log = {
  info: (msg: string) => console.log(chalk.blue("ℹ"), msg),
  success: (msg: string) => console.log(chalk.green("✓"), msg),
  warn: (msg: string) => console.log(chalk.yellow("⚠"), msg),
  error: (msg: string) => console.error(chalk.red("✗"), msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),

  header: (msg: string) => {
    console.log();
    console.log(chalk.bold.white(msg));
    console.log(chalk.dim("─".repeat(Math.min(msg.length + 4, 60))));
  },

  channel: (channel: string) => {
    const colors: Record<string, (s: string) => string> = {
      twitter: chalk.cyan,
      reddit: chalk.hex("#FF4500"),
      youtube: chalk.red,
      discord: chalk.hex("#5865F2"),
      blog: chalk.green,
    };
    const colorFn = colors[channel] ?? chalk.white;
    return colorFn(`[${channel}]`);
  },

  status: (status: string) => {
    const colors: Record<string, (s: string) => string> = {
      draft: chalk.yellow,
      approved: chalk.green,
      published: chalk.blue,
      rejected: chalk.red,
    };
    const colorFn = colors[status] ?? chalk.white;
    return colorFn(status);
  },

  table: (rows: string[][]) => {
    if (rows.length === 0) return;
    const colWidths = rows[0].map((_, i) =>
      Math.max(...rows.map((r) => (r[i] ?? "").length))
    );
    for (const row of rows) {
      console.log(
        row.map((cell, i) => cell.padEnd(colWidths[i])).join("  ")
      );
    }
  },

  verbose: (msg: string, isVerbose: boolean) => {
    if (isVerbose) console.log(chalk.dim(`  [verbose] ${msg}`));
  },
};
