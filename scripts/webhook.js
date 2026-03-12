/**
 * Express server for Twilio SMS webhook.
 * Receives incoming SMS, logs to context/log.md, gets a brief reply from Claude, replies via Twilio.
 * Run: npm run webhook
 * Set Twilio "A MESSAGE COMES IN" webhook to: https://your-app.railway.app/sms
 */

import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";
import { readFileSync, appendFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONTEXT_DIR = resolve(ROOT, "context");
const LOG_PATH = resolve(CONTEXT_DIR, "log.md");

const PORT = process.env.PORT || 3000;
const REQUIRED = ["ANTHROPIC_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"];

function checkEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error("Missing env:", missing.join(", "));
    process.exit(1);
  }
}

function ensureLogFile() {
  if (!existsSync(LOG_PATH)) {
    appendFileSync(LOG_PATH, "# SMS log\n\n", "utf-8");
  }
}

function appendLog(from, body, response) {
  const ts = new Date().toISOString();
  const block = `## ${ts}\n**From:** ${from}\n**Message:** ${body}\n**Response:** ${response}\n\n`;
  appendFileSync(LOG_PATH, block, "utf-8");
}

function readContext() {
  const goalsPath = resolve(CONTEXT_DIR, "goals.md");
  const accountabilityPath = resolve(CONTEXT_DIR, "accountability.md");
  const goals = existsSync(goalsPath) ? readFileSync(goalsPath, "utf-8") : "";
  const accountability = existsSync(accountabilityPath) ? readFileSync(accountabilityPath, "utf-8") : "";
  return { goals, accountability };
}

async function getClaudeReply(userMessage, goals, accountability) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const system = `You are a personal executive assistant replying over SMS. You have context about the user's goals (AI career track, SBA business acquisition) and accountability rules. Reply in one short message only: an acknowledgment, a follow-up question, or a brief reflection. No filler. SMS length: keep under 160 characters when possible. Direct and conversational.`;
  const user = `Context (goals and accountability):

<goals>
${goals}
</goals>

<accountability>
${accountability}
</accountability>

Incoming SMS from the user:
"${userMessage}"

Reply with a single brief SMS-style response (no quotes or labels):`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 150,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = response.content?.find((b) => b.type === "text")?.text ?? "Got it.";
  return text.trim().slice(0, 320); // max 2 segments
}

async function sendTwilioSms(to, body) {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return client.messages.create({
    body,
    from: process.env.TWILIO_FROM_NUMBER.trim(),
    to: to.trim(),
  });
}

const app = express();
app.use(express.urlencoded({ extended: true }));

app.post("/sms", (req, res) => {
  // Respond immediately so Twilio doesn't timeout
  res.type("text/xml").status(200).send("<Response></Response>");

  const from = req.body?.From ?? "";
  const body = (req.body?.Body ?? "").trim();
  if (!from || !body) {
    console.warn("[webhook] Missing From or Body");
    return;
  }

  (async () => {
    try {
      ensureLogFile();
      const { goals, accountability } = readContext();
      const reply = await getClaudeReply(body, goals, accountability);
      await sendTwilioSms(from, reply);
      appendLog(from, body, reply);
      console.log("[webhook] Replied to", from);
    } catch (err) {
      console.error("[webhook] Error:", err);
      appendLog(from, body, `[error: ${err.message}]`);
      try {
        await sendTwilioSms(from, "Something went wrong — try again in a bit.");
      } catch (_) {}
    }
  })();
});

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.listen(PORT, () => {
  checkEnv();
  ensureLogFile();
  console.log(`Webhook server listening on port ${PORT}. POST /sms for Twilio.`);
});
