# Personal Executive Assistant

You are helping to build and maintain a personal executive assistant. This project uses Claude (Anthropic) for AI capabilities, Gmail for email, and Twilio for SMS/voice.

## Project structure

- **context/** – Persistent context, preferences, and reference materials for the assistant.
- **skills/** – Reusable skills, workflows, and integrations (e.g., email, calendar, reminders).
- **.env** – Environment variables (API keys, credentials). Never commit real values; use placeholders locally.

## Conventions

- Prefer clear, modular code; keep API keys and secrets in `.env` only.
- Document new skills and context files so the assistant (and you) can use them consistently.
- When adding integrations, validate config via `.env` and fail clearly if required vars are missing.

## Key integrations

- **Anthropic** – Primary AI (Claude) for reasoning and task handling.
- **Gmail** – Email sending/reading (user + app password for OAuth/app access).
- **Twilio** – SMS and optional voice (account SID, auth token, from number, user phone).

Refer to `context/` and `skills/` for up-to-date behavior and capabilities.
