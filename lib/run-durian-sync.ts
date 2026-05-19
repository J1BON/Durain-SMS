import { spawn } from "child_process";
import path from "path";

export type DurianSyncRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

/** Run the same panel catalog sync used locally (FIX-AND-START / auto-sync). */
export function runDurianSyncScript(options?: {
  force?: boolean;
  quiet?: boolean;
}): Promise<DurianSyncRunResult> {
  const args = [path.join(process.cwd(), "scripts", "durian-auto-sync.mjs")];
  if (options?.quiet !== false) args.push("--quiet");
  if (options?.force) args.push("--force");

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}
