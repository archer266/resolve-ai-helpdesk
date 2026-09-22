import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tickets = [
  {
    requester: "Maya Chen",
    title: "VPN disconnects every few minutes",
    description: "The company VPN connects but drops after three or four minutes. I restarted my laptop and home router, but the problem keeps returning.",
    category: "Networking",
    priority: "High",
    status: "Open",
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

async function main() {
  if (await prisma.ticket.count()) return;
  for (const ticket of tickets) await prisma.ticket.create({ data: ticket });
}

main().finally(() => prisma.$disconnect());
