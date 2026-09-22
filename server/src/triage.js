import OpenAI from "openai";

const categories = ["Hardware", "Software", "Networking", "Account", "Security", "Other"];
const priorities = ["Low", "Medium", "High", "Critical"];

const triageSchema = {
  type: "object",
  properties: {
    category: { type: "string", enum: categories },
    priority: { type: "string", enum: priorities },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    summary: { type: "string" },
    suggestedAction: { type: "string" },
  },
  required: ["category", "priority", "confidence", "summary", "suggestedAction"],
  additionalProperties: false,
};

function localTriage(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const rules = [
    ["Security", ["phishing", "malware", "ransomware", "breach", "stolen", "suspicious login", "virus"]],
    ["Networking", ["wifi", "wi-fi", "internet", "network", "vpn", "dns", "router", "connection"]],
    ["Account", ["password", "login", "sign in", "account", "locked", "authentication", "mfa"]],
    ["Hardware", ["laptop", "monitor", "keyboard", "mouse", "printer", "screen", "battery", "dock"]],
    ["Software", ["app", "software", "excel", "outlook", "windows", "crash", "update", "install"]],
  ];
  const category = rules.find(([, words]) => words.some((word) => text.includes(word)))?.[0] || "Other";
  const critical = ["breach", "ransomware", "company-wide", "all users", "server down", "stolen"].some((word) => text.includes(word));
  const high = ["urgent", "cannot work", "locked", "phishing", "suspicious login", "vpn", "meeting", "deadline"].some((word) => text.includes(word));
  const low = ["question", "when possible", "cosmetic", "nice to have"].some((word) => text.includes(word));
  const priority = critical ? "Critical" : high ? "High" : low ? "Low" : "Medium";
  const actions = {
    Security: "Isolate the affected device if needed, preserve relevant logs, verify the report, and escalate through the security incident process.",
    Networking: "Confirm the scope, collect connection details, test basic connectivity, and review the relevant network or VPN logs.",
    Account: "Verify the user's identity, review recent sign-in activity, and follow the approved account recovery or access process.",
    Hardware: "Check power and physical connections, reproduce the issue, test with known-good accessories, and review device diagnostics.",
    Software: "Capture the exact error, confirm the application version, reproduce the issue, and check updates and recent configuration changes.",
    Other: "Ask for the exact error, impact, affected device, and steps already attempted before routing the request.",
  };
  const cleanDescription = description.replace(/\s+/g, " ").trim();
  return {
    category,
    priority,
    confidence: category === "Other" ? 0.58 : 0.78,
    summary: cleanDescription.length > 180 ? `${cleanDescription.slice(0, 177)}…` : cleanDescription,
    suggestedAction: actions[category],
    source: "fallback",
  };
}

export function isOpenAIEnabled() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function triageTicket({ title, description }) {
  if (!isOpenAIEnabled()) return localTriage(title, description);

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      instructions: [
        "You triage internal IT help-desk tickets.",
        "Judge priority by business impact and urgency, not emotional wording alone.",
        "Critical means an active security incident, broad outage, severe data risk, or safety issue.",
        "Create a concise neutral summary and one practical next action for a technician.",
        "If information is limited, lower confidence instead of inventing details.",
      ].join(" "),
      input: `Ticket title: ${title}\nTicket description: ${description}`,
      text: {
        format: {
          type: "json_schema",
          name: "ticket_triage",
          strict: true,
          schema: triageSchema,
        },
      },
    });

    const result = JSON.parse(response.output_text);
    return { ...result, source: "openai" };
  } catch (error) {
    console.error("OpenAI triage failed; using local fallback:", error.message);
    return localTriage(title, description);
  }
}
