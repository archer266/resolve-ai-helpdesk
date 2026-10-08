import assert from "node:assert/strict";
import { test } from "node:test";
import { triageTicket } from "../src/triage.js";

test("an unavailable OpenAI connection falls back after one mocked attempt", async (t) => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-for-mocked-requests";
  let attempts = 0;
  t.mock.method(globalThis, "fetch", async () => { attempts++; throw new Error("Simulated connection failure"); });
  try {
    const result = await triageTicket({ title: "VPN disconnects", description: "The VPN connection fails repeatedly before a meeting." });
    assert.equal(result.source, "fallback");
    assert.equal(result.category, "Networking");
    assert.equal(result.priority, "High");
    assert.equal(attempts, 1);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});
