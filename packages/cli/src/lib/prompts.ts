import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

let rl: ReturnType<typeof createInterface> | null = null;

function getRl() {
  if (!rl) rl = createInterface({ input: stdin, output: stdout });
  return rl;
}

export function closePrompts(): void {
  rl?.close();
  rl = null;
}

export async function prompt(question: string): Promise<string> {
  const answer = await getRl().question(question);
  return answer.trim();
}

/**
 * Hidden-input prompt for passwords. Uses raw mode + ANSI to mask input.
 * Falls back to a visible prompt if raw mode isn't supported.
 */
export async function promptPassword(question: string): Promise<string> {
  if (!stdin.isTTY) {
    return prompt(question);
  }

  return new Promise<string>((resolve) => {
    stdout.write(question);
    let buffer = "";
    stdin.setRawMode(true);
    stdin.resume();
    const onData = (chunk: Buffer) => {
      const ch = chunk.toString("utf8");
      // Control char codes
      const code = chunk[0];
      if (ch === "\n" || ch === "\r" || code === 0x04 /* Ctrl+D */) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolve(buffer);
        return;
      }
      if (code === 0x03 /* Ctrl+C */) {
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write("\n");
        process.exit(130);
      }
      if (code === 0x7f /* DEL / backspace */ || ch === "\b") {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }
      buffer += ch;
      stdout.write("*");
    };
    stdin.on("data", onData);
  });
}

export async function confirm(question: string, defaultYes = false): Promise<boolean> {
  const suffix = defaultYes ? "[Y/n]" : "[y/N]";
  const ans = (await prompt(`${question} ${suffix} `)).toLowerCase();
  if (!ans) return defaultYes;
  return ans.startsWith("y");
}
