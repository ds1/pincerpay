#!/usr/bin/env node
// Drive drizzle-kit generate through interactive rename prompts.
// Uses a counter so each "rename" prompt that arrives is answered exactly
// once with: down-arrow then enter.

import { spawn } from "node:child_process";

const child = spawn(
  "npx",
  ["drizzle-kit", "generate", "--name", "environment_scoping"],
  { cwd: process.cwd(), shell: true, stdio: ["pipe", "pipe", "inherit"] },
);

let answeredCount = 0;
let lastPromptText = "";

child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  // Extract the most recent prompt's question line.
  const match = text.match(/Is (\w+) column in (\w+) table created or renamed/);
  if (match) {
    const promptKey = `${match[1]}::${match[2]}`;
    if (promptKey !== lastPromptText) {
      lastPromptText = promptKey;
      answeredCount += 1;
      // Wait for prompt UI to fully render, then send down + enter.
      setTimeout(() => {
        child.stdin.write("\x1b[B");
        setTimeout(() => child.stdin.write("\r"), 200);
      }, 250);
    }
  }
});

child.on("exit", (code) => {
  process.stdout.write(
    `\n[drive-generate] drizzle-kit exited with code ${code} after ${answeredCount} rename prompts\n`,
  );
  process.exit(code ?? 1);
});
