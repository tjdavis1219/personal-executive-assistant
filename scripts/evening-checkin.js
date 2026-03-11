/**
 * Weekday evening check-in: sends one reflective question via SMS at 10:30 PM EST.
 * Schedule this script for 10:30 PM Eastern (e.g. Windows Task Scheduler). Skips on weekends and outside 10:25–10:35 PM ET.
 * npm run evening-checkin
 */

import "dotenv/config";
import twilio from "twilio";

const EVENING_QUESTIONS = [
  "What did you actually move forward today — or did you just stay busy?",
  "Did you make progress on what matters, or just stay busy?",
  "Did you move the needle on AI or SBA today — or did the day get away from you?",
  "One thing you moved forward today that actually matters — what was it?",
  "Today: progress on your goals, or just busy work?",
];

const TWILIO_ENV = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "MY_PHONE_NUMBER",
];

/** Send window: 10:25–10:35 PM Eastern (America/New_York) */
function isWithinSendWindow() {
  const now = new Date();
  const et = now.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit" });
  const [h, m] = et.split(":").map(Number);
  return h === 22 && m >= 25 && m <= 35;
}

function isWeekday() {
  const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  return day >= 1 && day <= 5;
}

function getTodaysQuestion() {
  const dayIndex = new Date().getDay() - 1; // Mon=0 .. Fri=4
  return EVENING_QUESTIONS[dayIndex];
}

function checkEnv() {
  const missing = TWILIO_ENV.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error("Missing required env vars:", missing.join(", "));
    process.exit(1);
  }
}

async function sendSms(text) {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  return client.messages.create({
    body: text,
    from: process.env.TWILIO_FROM_NUMBER.trim(),
    to: process.env.MY_PHONE_NUMBER.trim(),
  });
}

async function main() {
  if (!isWeekday()) {
    console.log("Weekend — skipping evening check-in.");
    return;
  }
  if (!isWithinSendWindow()) {
    console.log("Outside send window (10:25–10:35 PM ET). Schedule this script for 10:30 PM Eastern. Skipping.");
    return;
  }
  checkEnv();
  const question = getTodaysQuestion();
  console.log("Sending evening check-in (10:30 PM ET):", question);
  const message = await sendSms(question);
  console.log("Sent. Twilio SID:", message.sid, "Status:", message.status);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
