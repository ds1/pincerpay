import type { Command } from "commander";
import { startServer } from "../../web/server.js";

export function registerDashboardCommand(program: Command): void {
  program
    .command("dashboard")
    .description("Start local web dashboard for content review and publishing")
    .option("-p, --port <port>", "Port number", "3847")
    .action((opts) => {
      const port = parseInt(opts.port, 10);
      startServer(port);
    });
}
