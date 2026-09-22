import { useEffect, useMemo, useState } from "react";

const emptyTicket = { requester: "", title: "", description: "" };
const defaultSettings = { analystName: "William S.", defaultStatus: "All", compactMode: false, highPriorityAlerts: true, dailyDigest: false };
const starterArticles = [
  { id: "kb-vpn", title: "Fix an unstable VPN connection", category: "Networking", summary: "First-line checks for a VPN that connects and then repeatedly disconnects.", steps: ["Confirm whether the internet connection works without the VPN.", "Restart the VPN client and sign in again.", "Check for a pending VPN client update.", "Collect the client logs and escalate if the disconnect continues."], updated: "Sep 18, 2026" },
  { id: "kb-password", title: "Microsoft 365 account recovery", category: "Account", summary: "Safely restore access when self-service password reset is unavailable.", steps: ["Verify the employee using the approved identity process.", "Review recent sign-in activity for suspicious access.", "Issue a temporary password.", "Require a password change and MFA verification at next sign-in."], updated: "Sep 16, 2026" },
  { id: "kb-monitor", title: "External monitor not detected", category: "Hardware", summary: "Troubleshoot monitors connected directly or through a docking station.", steps: ["Reseat the power, display, and docking-station cables.", "Use Display Settings to detect the monitor.", "Test a known-good cable or display.", "Update the graphics driver and dock firmware."], updated: "Sep 12, 2026" },
  { id: "kb-phishing", title: "Respond to a suspected phishing email", category: "Security", summary: "Contain and report suspicious messages without destroying evidence.", steps: ["Do not open attachments or follow links.", "Use the company reporting tool to submit the message.", "If credentials were entered, reset the password immediately.", "Escalate to security and preserve the original message."], updated: "Sep 8, 2026" },
];

function readStored(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function Logo() {
  return <div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" role="img"><path d="M35.8 10.9c-8.2-6.2-21.1-2.4-25.7 6.2-4.9 9.1 1.2 20.4 11.3 22.2 8.5 1.5 17.1-4.5 17.5-13.3.3-6.9-5-12.7-11.8-13.1-5.5-.3-10.4 3.8-10.8 9.3-.3 4.4 3 8.2 7.4 8.5 3.5.2 6.6-2.4 6.8-5.9.2-2.8-1.9-5.3-4.7-5.5" /></svg></div>;
}

function relativeTime(value) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function TicketCard({ ticket, selected, onClick }) {
  return <button className={`ticket-card ${selected ? "selected" : ""}`} onClick={onClick}>
    <div className="ticket-topline"><span className="ticket-id">#{String(ticket.id).padStart(4, "0")}</span><span className={`priority ${ticket.priority.toLowerCase()}`}>{ticket.priority}</span></div>
    <strong>{ticket.title}</strong><p>{ticket.summary || ticket.description}</p>
    <div className="ticket-meta"><span>{ticket.category}</span><span>{relativeTime(ticket.createdAt)}</span></div>
  </button>;
}

function NewTicketModal({ onClose, onCreated }) {
  const [form, setForm] = useState(emptyTicket);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Ticket creation failed.");
      onCreated(body);
    } catch (caught) { setError(caught.message); } finally { setLoading(false); }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(event) => event.stopPropagation()}>
    <div className="modal-header"><div><span className="eyebrow">NEW REQUEST</span><h2>What can we help with?</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
    <form onSubmit={submit}>
      <label>Your name<input required value={form.requester} onChange={(event) => setForm({ ...form, requester: event.target.value })} placeholder="Jordan Lee" /></label>
      <label>Short title<input required minLength="4" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Cannot connect to office Wi-Fi" /></label>
      <label>Describe the problem<textarea required minLength="12" rows="6" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Tell us what happened, what you expected, and anything you already tried." /></label>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={loading}>{loading ? "Analyzing…" : "Create & triage"}</button></div>
    </form>
  </div></div>;
}

function NewArticleModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: "", category: "Software", summary: "", steps: "" });
  function submit(event) {
    event.preventDefault();
    onCreated({ id: `kb-${Date.now()}`, title: form.title.trim(), category: form.category, summary: form.summary.trim(), steps: form.steps.split("\n").map((step) => step.trim()).filter(Boolean), updated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(event) => event.stopPropagation()}>
    <div className="modal-header"><div><span className="eyebrow">KNOWLEDGE BASE</span><h2>Create an article</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
    <form onSubmit={submit}>
      <label>Article title<input required minLength="5" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Troubleshoot a frozen application" /></label>
      <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Software</option><option>Hardware</option><option>Networking</option><option>Account</option><option>Security</option><option>Other</option></select></label>
      <label>Short summary<input required minLength="10" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="A quick description of this solution." /></label>
      <label>Steps — one per line<textarea required rows="7" value={form.steps} onChange={(event) => setForm({ ...form, steps: event.target.value })} placeholder={"Confirm the exact error message\nRestart the application\nCheck for available updates"} /></label>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Publish article</button></div>
    </form>
  </div></div>;
}

function Dashboard({ tickets, selected, setSelectedId, loading, loadTickets, search, setSearch, statusFilter, setStatusFilter, setStatus, retriage, retriaging, aiEnabled }) {
  const visibleTickets = useMemo(() => tickets.filter((ticket) => {
    const text = `${ticket.title} ${ticket.requester} ${ticket.category} ${ticket.description}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (statusFilter === "All" || ticket.status === statusFilter);
  }), [tickets, search, statusFilter]);
  const stats = {
    open: tickets.filter((ticket) => ticket.status === "Open").length,
    urgent: tickets.filter((ticket) => ["Critical", "High"].includes(ticket.priority) && ticket.status !== "Resolved").length,
    resolved: tickets.filter((ticket) => ticket.status === "Resolved").length,
  };
  const activeTicket = selected || visibleTickets[0];

  return <>
    <section className="stats-grid">
      <article><span>OPEN TICKETS</span><strong>{stats.open}</strong><small>Awaiting action</small></article>
      <article><span>HIGH PRIORITY</span><strong>{stats.urgent}</strong><small>Needs attention</small></article>
      <article><span>RESOLVED</span><strong>{stats.resolved}</strong><small>Completed requests</small></article>
      <article className="ai-stat"><span>AI TRIAGE</span><strong>{aiEnabled ? "Live" : "Demo"}</strong><small>{aiEnabled ? "OpenAI enabled" : "Rules enabled"}</small></article>
    </section>
    <section className="workspace">
      <div className="queue-panel">
        <div className="panel-heading"><div><span className="eyebrow">INBOX</span><h2>Ticket queue</h2></div><button className="icon-button" onClick={loadTickets}>↻</button></div>
        <div className="filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets…" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option>Open</option><option>In Progress</option><option>Resolved</option></select></div>
        <div className="ticket-list">
          {loading && <div className="empty-state">Loading tickets…</div>}
          {!loading && !visibleTickets.length && <div className="empty-state">No tickets match this view.</div>}
          {visibleTickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} selected={activeTicket?.id === ticket.id} onClick={() => setSelectedId(ticket.id)} />)}
        </div>
      </div>
      <div className="detail-panel">
        {!activeTicket ? <div className="empty-detail"><Logo /><h2>Select a ticket</h2><p>Ticket details and AI recommendations will appear here.</p></div> : <>
          <div className="detail-heading"><div><span className="ticket-id">TICKET #{String(activeTicket.id).padStart(4, "0")}</span><h2>{activeTicket.title}</h2><p>Submitted by {activeTicket.requester} · {relativeTime(activeTicket.createdAt)}</p></div><span className={`status-badge ${activeTicket.status.toLowerCase().replace(" ", "-")}`}>{activeTicket.status}</span></div>
          <div className="detail-body">
            <section><span className="eyebrow">REQUEST</span><p className="description">{activeTicket.description}</p></section>
            <section className="triage-box">
              <div className="triage-title"><div><span className="spark">✦</span><span><strong>Resolve triage</strong><small>{activeTicket.triageSource === "openai" ? "Analyzed with OpenAI" : "Local fallback analysis"}</small></span></div><button onClick={retriage} disabled={retriaging}>{retriaging ? "Analyzing…" : "Run again"}</button></div>
              <div className="triage-grid"><div><span>CATEGORY</span><strong>{activeTicket.category}</strong></div><div><span>PRIORITY</span><strong className={`priority-text ${activeTicket.priority.toLowerCase()}`}>{activeTicket.priority}</strong></div><div><span>CONFIDENCE</span><strong>{Math.round(activeTicket.aiConfidence * 100)}%</strong></div></div>
              <div className="recommendation"><span>RECOMMENDED NEXT ACTION</span><p>{activeTicket.suggestedAction}</p></div>
            </section>
            <section><span className="eyebrow">AI SUMMARY</span><p className="description">{activeTicket.summary}</p></section>
          </div>
          <div className="detail-actions">{activeTicket.status !== "Resolved" ? <><button className="secondary-button" onClick={() => setStatus("In Progress")}>Start work</button><button className="primary-button" onClick={() => setStatus("Resolved")}>✓ Mark resolved</button></> : <button className="secondary-button" onClick={() => setStatus("Open")}>Reopen ticket</button>}</div>
        </>}
      </div>
    </section>
  </>;
}

function KnowledgeBase({ articles, setArticles, onNewArticle }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedId, setSelectedId] = useState(articles[0]?.id);
  const [helpfulId, setHelpfulId] = useState(null);
  const visible = articles.filter((article) => (category === "All" || article.category === category) && `${article.title} ${article.summary} ${article.steps.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const selected = articles.find((article) => article.id === selectedId) || visible[0];
  function removeArticle() {
    if (!selected || !window.confirm(`Delete “${selected.title}”?`)) return;
    const next = articles.filter((article) => article.id !== selected.id);
    setArticles(next); setSelectedId(next[0]?.id);
  }
  return <section className="knowledge-layout">
    <div className="knowledge-list panel-card">
      <div className="panel-heading"><div><span className="eyebrow">DOCUMENTATION</span><h2>{articles.length} articles</h2></div><button className="primary-button small-button" onClick={onNewArticle}>＋ Add</button></div>
      <div className="filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search solutions…" /><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option><option>Software</option><option>Hardware</option><option>Networking</option><option>Account</option><option>Security</option><option>Other</option></select></div>
      <div className="article-list">{visible.map((article) => <button key={article.id} className={`article-card ${selected?.id === article.id ? "selected" : ""}`} onClick={() => setSelectedId(article.id)}><span className="article-category">{article.category}</span><strong>{article.title}</strong><p>{article.summary}</p><small>Updated {article.updated}</small></button>)}{!visible.length && <div className="empty-state">No articles match your search.</div>}</div>
    </div>
    <article className="article-detail panel-card">
      {!selected ? <div className="empty-detail"><h2>No article selected</h2></div> : <><div className="article-hero"><span className="article-category">{selected.category}</span><h2>{selected.title}</h2><p>{selected.summary}</p><small>Last updated {selected.updated}</small></div><div className="article-content"><span className="eyebrow">RESOLUTION STEPS</span><ol>{selected.steps.map((step, index) => <li key={`${selected.id}-${index}`}><span>{index + 1}</span><p>{step}</p></li>)}</ol></div><div className="article-footer"><span>{helpfulId === selected.id ? "Thanks—feedback recorded." : "Was this article useful?"}</span><div><button className="secondary-button" onClick={() => setHelpfulId(selected.id)}>{helpfulId === selected.id ? "✓ Helpful" : "Yes"}</button><button className="danger-button" onClick={removeArticle}>Delete</button></div></div></>}
    </article>
  </section>;
}

function BarRow({ label, value, total, tone = "green" }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return <div className="bar-row"><div><span>{label}</span><strong>{value}</strong></div><div className="bar-track"><span className={tone} style={{ width: `${percent}%` }} /></div></div>;
}

function Analytics({ tickets }) {
  const total = tickets.length;
  const resolved = tickets.filter((ticket) => ticket.status === "Resolved").length;
  const avgConfidence = total ? Math.round(tickets.reduce((sum, ticket) => sum + ticket.aiConfidence, 0) / total * 100) : 0;
  const aiTickets = tickets.filter((ticket) => ticket.triageSource === "openai").length;
  const categories = ["Networking", "Account", "Hardware", "Software", "Security", "Other"];
  const priorities = ["Critical", "High", "Medium", "Low"];
  return <>
    <section className="analytics-summary">
      <article><span>TOTAL TICKETS</span><strong>{total}</strong><small>All recorded requests</small></article>
      <article><span>RESOLUTION RATE</span><strong>{total ? Math.round(resolved / total * 100) : 0}%</strong><small>{resolved} tickets resolved</small></article>
      <article><span>AVG. CONFIDENCE</span><strong>{avgConfidence}%</strong><small>Across AI classifications</small></article>
      <article><span>LIVE AI TRIAGE</span><strong>{aiTickets}</strong><small>{total - aiTickets} used local fallback</small></article>
    </section>
    <section className="analytics-grid">
      <article className="panel-card analytics-card"><div className="card-title"><span className="eyebrow">WORKLOAD</span><h2>Tickets by category</h2></div><div className="bars">{categories.map((name) => <BarRow key={name} label={name} value={tickets.filter((ticket) => ticket.category === name).length} total={total} />)}</div></article>
      <article className="panel-card analytics-card"><div className="card-title"><span className="eyebrow">URGENCY</span><h2>Priority distribution</h2></div><div className="bars">{priorities.map((name) => <BarRow key={name} label={name} value={tickets.filter((ticket) => ticket.priority === name).length} total={total} tone={name.toLowerCase()} />)}</div></article>
      <article className="panel-card analytics-card wide-card"><div className="card-title"><span className="eyebrow">PIPELINE</span><h2>Current ticket status</h2></div><div className="status-metrics"><div><span className="metric-dot open" /><strong>{tickets.filter((ticket) => ticket.status === "Open").length}</strong><small>Open</small></div><div><span className="metric-dot progress" /><strong>{tickets.filter((ticket) => ticket.status === "In Progress").length}</strong><small>In progress</small></div><div><span className="metric-dot resolved" /><strong>{resolved}</strong><small>Resolved</small></div></div></article>
    </section>
  </>;
}

function Toggle({ checked, onChange }) {
  return <button type="button" role="switch" aria-checked={checked} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><span /></button>;
}

function Settings({ settings, setSettings, aiInfo, refreshAI }) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  function save(event) {
    event.preventDefault(); setSettings(draft); localStorage.setItem("resolve-settings", JSON.stringify(draft)); setSaved(true); setTimeout(() => setSaved(false), 1800);
  }
  return <section className="settings-grid">
    <form className="panel-card settings-card" onSubmit={save}>
      <div className="card-title"><span className="eyebrow">PREFERENCES</span><h2>Workspace settings</h2><p>These preferences are saved in this browser.</p></div>
      <div className="setting-field"><label>Display name<input value={draft.analystName} onChange={(event) => setDraft({ ...draft, analystName: event.target.value })} /></label></div>
      <div className="setting-field"><label>Default ticket view<select value={draft.defaultStatus} onChange={(event) => setDraft({ ...draft, defaultStatus: event.target.value })}><option>All</option><option>Open</option><option>In Progress</option><option>Resolved</option></select></label></div>
      <div className="setting-row"><div><strong>Compact ticket list</strong><p>Show more tickets with less spacing.</p></div><Toggle checked={draft.compactMode} onChange={(value) => setDraft({ ...draft, compactMode: value })} /></div>
      <div className="setting-row"><div><strong>High-priority alerts</strong><p>Highlight urgent requests in the command center.</p></div><Toggle checked={draft.highPriorityAlerts} onChange={(value) => setDraft({ ...draft, highPriorityAlerts: value })} /></div>
      <div className="setting-row"><div><strong>Daily digest</strong><p>Save the preference for a future email integration.</p></div><Toggle checked={draft.dailyDigest} onChange={(value) => setDraft({ ...draft, dailyDigest: value })} /></div>
      <div className="settings-actions"><button className="primary-button">{saved ? "✓ Saved" : "Save changes"}</button></div>
    </form>
    <aside className="panel-card connection-card">
      <div className="card-title"><span className="eyebrow">INTEGRATION</span><h2>AI connection</h2></div>
      <div className={`connection-status ${aiInfo.enabled ? "connected" : "offline"}`}><span className="status-dot" /><div><strong>{aiInfo.enabled ? "OpenAI connected" : "Local fallback active"}</strong><p>{aiInfo.enabled ? "New and re-triaged tickets use the OpenAI API." : "Resolve works locally until an API key is added."}</p></div></div>
      <dl><div><dt>Model</dt><dd>{aiInfo.model || "gpt-4o-mini"}</dd></div><div><dt>API key</dt><dd>{aiInfo.enabled ? "Configured" : "Not configured"}</dd></div><div><dt>Key location</dt><dd>server/.env</dd></div></dl>
      <button className="secondary-button full-button" onClick={refreshAI}>↻ Refresh connection</button>
      <p className="security-note">Your API key is read only by the server and is never displayed in the browser.</p>
    </aside>
  </section>;
}

const pageCopy = {
  dashboard: ["SUPPORT OPERATIONS", "Command center", "See what needs attention and let Resolve handle the first pass."],
  knowledge: ["TEAM RESOURCES", "Knowledge base", "Store repeatable solutions and give technicians a reliable playbook."],
  analytics: ["PERFORMANCE", "Analytics", "Understand ticket volume, urgency, resolution, and AI usage."],
  settings: ["ADMINISTRATION", "Settings", "Control your workspace preferences and verify the AI connection."],
};

export default function App() {
  const storedSettings = readStored("resolve-settings", defaultSettings);
  const [view, setView] = useState("dashboard");
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState(storedSettings);
  const [statusFilter, setStatusFilter] = useState(storedSettings.defaultStatus || "All");
  const [articles, setArticlesState] = useState(() => readStored("resolve-articles", starterArticles));
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiInfo, setAiInfo] = useState({ enabled: false, model: "gpt-4o-mini" });
  const [retriaging, setRetriaging] = useState(false);

  function setArticles(next) { setArticlesState(next); localStorage.setItem("resolve-articles", JSON.stringify(next)); }
  async function loadTickets() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/tickets");
      if (!response.ok) throw new Error("Could not load tickets.");
      const data = await response.json(); setTickets(data); setSelectedId((current) => current ?? data[0]?.id ?? null);
    } catch (caught) { setError(`${caught.message} Make sure the Resolve server is running.`); } finally { setLoading(false); }
  }
  async function refreshAI() {
    try { const response = await fetch("/api/ai/status"); setAiInfo(await response.json()); } catch { setAiInfo({ enabled: false, model: "Unavailable" }); }
  }
  useEffect(() => { loadTickets(); refreshAI(); }, []);
  useEffect(() => { setStatusFilter(settings.defaultStatus); }, [settings.defaultStatus]);
  const selected = tickets.find((ticket) => ticket.id === selectedId);

  async function setStatus(status) {
    if (!selected) return;
    const response = await fetch(`/api/tickets/${selected.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const updated = await response.json(); setTickets((current) => current.map((ticket) => ticket.id === updated.id ? updated : ticket));
  }
  async function retriage() {
    if (!selected) return; setRetriaging(true);
    try {
      const response = await fetch(`/api/tickets/${selected.id}/retriage`, { method: "POST" });
      const updated = await response.json(); if (!response.ok) throw new Error(updated.error || "Triage failed.");
      setTickets((current) => current.map((ticket) => ticket.id === updated.id ? updated : ticket));
    } catch (caught) { setError(caught.message); } finally { setRetriaging(false); }
  }

  const copy = pageCopy[view];
  const navItems = [["dashboard", "⌁", "Command center"], ["knowledge", "◎", "Knowledge base"], ["analytics", "◫", "Analytics"], ["settings", "⚙", "Settings"]];
  const initials = settings.analystName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return <div className={`app-shell ${settings.compactMode ? "compact-mode" : ""}`}>
    <aside className="sidebar">
      <div className="brand"><Logo /><div><strong>Resolve</strong><span>Support intelligence</span></div></div>
      <nav>{navItems.map(([id, icon, label]) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => setView(id)}><span>{icon}</span>{label}</button>)}</nav>
      <div className={`ai-card ${aiInfo.enabled ? "online" : "fallback"}`}><div className="status-row"><span className="status-dot" /><strong>{aiInfo.enabled ? "OpenAI connected" : "Local fallback"}</strong></div><p>{aiInfo.enabled ? "New tickets use live AI triage." : "Add an API key to enable live AI."}</p></div>
      <div className="profile"><span>{initials}</span><div><strong>{settings.analystName}</strong><small>Administrator</small></div></div>
    </aside>
    <main>
      <header><div><span className="eyebrow">{copy[0]}</span><h1>{copy[1]}</h1><p>{copy[2]}</p></div>{view === "dashboard" && <button className="primary-button" onClick={() => setShowTicketModal(true)}>＋ New ticket</button>}{view === "knowledge" && <button className="primary-button" onClick={() => setShowArticleModal(true)}>＋ New article</button>}</header>
      {error && <div className="banner-error">{error}<button onClick={() => setError("")}>×</button></div>}
      {view === "dashboard" && <Dashboard tickets={tickets} selected={selected} setSelectedId={setSelectedId} loading={loading} loadTickets={loadTickets} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} setStatus={setStatus} retriage={retriage} retriaging={retriaging} aiEnabled={aiInfo.enabled} />}
      {view === "knowledge" && <KnowledgeBase articles={articles} setArticles={setArticles} onNewArticle={() => setShowArticleModal(true)} />}
      {view === "analytics" && <Analytics tickets={tickets} />}
      {view === "settings" && <Settings settings={settings} setSettings={setSettings} aiInfo={aiInfo} refreshAI={refreshAI} />}
    </main>
    {showTicketModal && <NewTicketModal onClose={() => setShowTicketModal(false)} onCreated={(ticket) => { setTickets((current) => [ticket, ...current]); setSelectedId(ticket.id); setShowTicketModal(false); }} />}
    {showArticleModal && <NewArticleModal onClose={() => setShowArticleModal(false)} onCreated={(article) => { setArticles([article, ...articles]); setShowArticleModal(false); }} />}
  </div>;
}
