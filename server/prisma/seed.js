const tickets = [
  {
    requester: "Maya Chen",
    title: "VPN disconnects every few minutes",
    description: "The company VPN connects but drops after three or four minutes. I restarted my laptop and home router, but the problem keeps returning.",
    category: "Networking",
    priority: "High",
    status: "New",
    summary: "Remote employee has repeated VPN disconnections despite restarting the laptop and router.",
    suggestedAction: "Confirm whether other remote users are affected, collect the VPN client logs, and check the user's connection profile and gateway health.",
    aiConfidence: 0.94,
    triageSource: "fallback",
  },
  {
    requester: "Darius Hill",
    title: "Cannot reset Microsoft 365 password",
    description: "The password reset page says my account cannot be verified. I need access to email before this afternoon's client meeting.",
    category: "Account",
    priority: "High",
    status: "In Progress",
    summary: "User is locked out of Microsoft 365 and self-service identity verification is failing before a client meeting.",
    suggestedAction: "Verify the user's identity through the approved process, review sign-in logs, then issue a temporary password and require a reset at next login.",
    aiConfidence: 0.97,
    triageSource: "fallback",
  },
  {
    requester: "Ana Torres",
    title: "Second monitor is not detected",
    description: "My docking station powers the laptop, but Windows does not see the monitor connected through HDMI.",
    category: "Hardware",
    priority: "Medium",
    status: "Resolved",
    summary: "External monitor is not detected when connected through the laptop docking station.",
    suggestedAction: "Reseat the dock and HDMI connections, test another cable or display, and update the dock firmware and graphics driver.",
    aiConfidence: 0.91,
    triageSource: "fallback",
  },
];

const articles = [
  { id: "kb-vpn", title: "Fix an unstable VPN connection", category: "Networking", summary: "First-line checks for a VPN that connects and then repeatedly disconnects.", steps: ["Confirm whether the internet connection works without the VPN.", "Restart the VPN client and sign in again.", "Check for a pending VPN client update.", "Collect the client logs and escalate if the disconnect continues."] },
  { id: "kb-password", title: "Microsoft 365 account recovery", category: "Account", summary: "Safely restore access when self-service password reset is unavailable.", steps: ["Verify the employee using the approved identity process.", "Review recent sign-in activity for suspicious access.", "Issue a temporary password.", "Require a password change and MFA verification at next sign-in."] },
  { id: "kb-monitor", title: "External monitor not detected", category: "Hardware", summary: "Troubleshoot monitors connected directly or through a docking station.", steps: ["Reseat the power, display, and docking-station cables.", "Use Display Settings to detect the monitor.", "Test a known-good cable or display.", "Update the graphics driver and dock firmware."] },
  { id: "kb-phishing", title: "Respond to a suspected phishing email", category: "Security", summary: "Contain and report suspicious messages without destroying evidence.", steps: ["Do not open attachments or follow links.", "Use the company reporting tool to submit the message.", "If credentials were entered, reset the password immediately.", "Escalate to security and preserve the original message."] },
];

export async function seedDatabase(prisma) {
  await prisma.$transaction(async (db) => {
    if (!await db.appMetadata.findUnique({ where: { key: "demoTicketsSeeded" } })) {
      if (!await db.ticket.count()) {
        for (const ticket of tickets) await db.ticket.create({ data: {
          ...ticket, activities: { create: { type: "created", body: "Demo ticket created.", author: "Resolve" } },
        } });
      }
      await db.appMetadata.create({ data: { key: "demoTicketsSeeded", value: "true" } });
    }
    if (!await db.appMetadata.findUnique({ where: { key: "starterArticlesSeeded" } })) {
      for (const article of articles) await db.knowledgeArticle.upsert({
        where: { id: article.id }, update: {}, create: { ...article, steps: JSON.stringify(article.steps) },
      });
      await db.appMetadata.create({ data: { key: "starterArticlesSeeded", value: "true" } });
    }
  });
}
