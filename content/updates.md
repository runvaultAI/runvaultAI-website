# RunVault updates

Entries use the format `## YYYY-MM-DD — Title`. Newest first; rendering is sorted by date, so order in this file doesn't matter.

## 2026-04-20 — Private beta opens

We're onboarding the first cohort of design partners this week. Ten AI-native teams running multi-agent deployments in production, across research, support, and agentic commerce.

If you're shipping agents that spend real money and want a wallet they can't bypass, reach out at `contact@runvault.ai`.

## 2026-04-02 — Concurrency proof landed

Stress-tested the atomic gate with 1,000 concurrent agents hitting the same cap. Zero double-spends. Zero race conditions. P99 overhead under 5ms.

The invariant: the cap debit and the authorization check happen in a single Redis Lua script. Either both succeed or neither does — there is no window where two agents can both see "budget available" and both spend.

## 2026-03-15 — MCP server goes live

Any MCP-compatible agent — Claude Desktop, an MCP client in LangGraph, a custom integration — can now connect to RunVault natively. No code changes on the agent side.

Three tools exposed:

- `authorize_spend(amount, merchant)` — runs the cap check before the charge
- `check_budget()` — returns remaining authority and scope
- `get_agent_ledger()` — full audit trail by agent, run, and timestamp

## 2026-02-20 — Virtual card lifecycle end-to-end

The full flow now runs in staging: `agent.pay()` → cap check → Stripe Issuing card provisioned → merchant-locked, hard-capped, auto-cancelled after the charge settles. Single-use. Never reissued.

Interchange economics confirmed at target GMV. More to share as we move toward the GA BIN programme.

## 2026-01-10 — Python SDK v0.1 published

```
pip install runvault
```

Two-line integration. Tested against the Anthropic and OpenAI SDKs. MIT-licensed. Go and Node SDKs land with the public GA milestone.
