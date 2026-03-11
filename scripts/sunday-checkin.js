/**
 * Sunday evening check-in: generates a personalized summary via Claude,
 * emails it via Gmail, and sends a short SMS nudge via Twilio.
 * Run: npm run sunday-checkin (or node scripts/sunday-checkin.js)
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONTEXT_DIR = resolve(ROOT, "context");

const REQUIRED_ENV = [
  "ANTHROPIC_API_KEY",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "MY_PHONE_NUMBER",
];

function checkEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error("Missing required env vars:", missing.join(", "));
    process.exit(1);
  }
}

function readContext() {
  const goalsPath = resolve(CONTEXT_DIR, "goals.md");
  const accountabilityPath = resolve(CONTEXT_DIR, "accountability.md");
  const goals = readFileSync(goalsPath, "utf-8");
  const accountability = readFileSync(accountabilityPath, "utf-8");
  return { goals, accountability };
}

const CHECKIN_SYSTEM = `You are writing a Sunday evening check-in for someone who has two tracks: (1) AI career development / building with AI, and (2) SBA business acquisition. The check-in must cover only two things: AI builds—did they make tangible progress this week or just think about it? SBA—did they take any concrete action or did it stay in research mode? Be direct, no softening. If they've had no progress on either track in 7 days, call it out clearly. Use their accountability rules and goals for tone and focus. Keep the email tight and useful; no filler.`;

const CHECKIN_USER = (goals, accountability) => `
Use these context files to personalize the check-in:

<goals>
${goals}
</goals>

<accountability>
${accountability}
</accountability>

Write your response in this exact format:
1. First, the full email body (plain text, no subject line). Use clear sections if helpful. End the email body with a blank line.
2. Then a single line containing exactly: ---SMS---
3. Then the SMS version: one short sentence or question (under 160 characters) that works as a nudge. No quote marks or labels, just the SMS text.
`;

async function generateCheckin(goals, accountability) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: CHECKIN_SYSTEM,
    messages: [
      {
        role: "user",
        content: CHECKIN_USER(goals, accountability),
      },
    ],
  });

  const text =
    response.content?.find((b) => b.type === "text")?.text ?? "";
  const smsMarker = "---SMS---";
  const idx = text.indexOf(smsMarker);
  if (idx === -1) {
    return { emailBody: text.trim(), smsText: "Weekly check-in ready — check your email." };
  }
  const emailBody = text.slice(0, idx).trim();
  const smsText = text.slice(idx + smsMarker.length).trim().slice(0, 160);
  return { emailBody, smsText: smsText || "Weekly check-in ready — check your email." };
}

async function sendEmail(body) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: process.env.GMAIL_USER,
    subject: "Sunday check-in — AI & SBA",
    text: body,
  });
}

async function sendSms(text) {
  const from = process.env.TWILIO_FROM_NUMBER.trim();
  const to = process.env.MY_PHONE_NUMBER.trim();
  console.log("[SMS] Request:", { from, to, bodyLength: text.length, bodyPreview: text.slice(0, 50) + (text.length > 50 ? "..." : "") });

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  const message = await client.messages.create({
    body: text,
    from,
    to,
  });

  console.log("[SMS] Twilio response:", JSON.stringify({
    sid: message.sid,
    status: message.status,
    dateCreated: message.dateCreated,
    dateUpdated: message.dateUpdated,
    to: message.to,
    from: message.from,
    errorCode: message.errorCode,
    errorMessage: message.errorMessage,
    numSegments: message.numSegments,
  }, null, 2));
  return message;
}

async function main() {
  checkEnv();
  console.log("Reading context...");
  const { goals, accountability } = readContext();
  console.log("Generating check-in with Claude...");
  const { emailBody, smsText } = await generateCheckin(goals, accountability);
  console.log("Sending email...");
  await sendEmail(emailBody);
  console.log("Sending SMS...");
  await sendSms(smsText);
  console.log("Done. Check your email and phone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
