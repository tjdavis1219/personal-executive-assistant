/**
 * Long-running scheduler for Railway (or any 24/7 host).
 * Runs sunday-checkin.js every Sunday 7:00 PM ET and evening-checkin.js Mon–Fri 10:30 PM ET.
 * Start with: npm start (or node scripts/scheduler.js)
 */

import "dotenv/config";
import cron from "node-cron";
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TZ = "America/New_York";

function runScript(name, scriptPath) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("node", [scriptPath], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
    });
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`${name} exited with code ${code}`));
      else resolvePromise();
    });
    child.on("error", reject);
  });
}

cron.schedule(
  "0 19 * * 0",
  () => {
    console.log("[Scheduler] Running Sunday check-in (7 PM ET)");
    runScript("sunday-checkin", "scripts/sunday-checkin.js").catch((err) =>
      console.error("[Scheduler] Sunday check-in failed:", err)
    );
  },
  { timezone: TZ }
);

cron.schedule(
  "30 22 * * 1-5",
  () => {
    console.log("[Scheduler] Running evening check-in (10:30 PM ET)");
    runScript("evening-checkin", "scripts/evening-checkin.js").catch((err) =>
      console.error("[Scheduler] Evening check-in failed:", err)
    );
  },
  { timezone: TZ }
);

console.log("Scheduler running (Sunday 7 PM ET, Mon–Fri 10:30 PM ET). Press Ctrl+C to stop.");
