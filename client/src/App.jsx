import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import TicketWorkspace from "./TicketWorkspace";
import Modal from "./Modal";

const emptyTicket = { requester: "", title: "", description: "" };
const defaultSettings = { analystName: "William S.", defaultStatus: "All", compactMode: false, highPriorityAlerts: true };
function readStored(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function Logo() {
  return <div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" role="img"><path d="M35.8 10.9c-8.2-6.2-21.1-2.4-25.7 6.2-4.9 9.1 1.2 20.4 11.3 22.2 8.5 1.5 17.1-4.5 17.5-13.3.3-6.9-5-12.7-11.8-13.1-5.5-.3-10.4 3.8-10.8 9.3-.3 4.4 3 8.2 7.4 8.5 3.5.2 6.6-2.4 6.8-5.9.2-2.8-1.9-5.3-4.7-5.5" /></svg></div>;
}

function NewTicketModal({ onClose, onCreated }) {
  const [form, setForm] = useState(emptyTicket);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError("");
    try { onCreated(await api("/api/tickets", { method: "POST", body: form })); }
    catch (caught) { setError(caught.message); } finally { setLoading(false); }
  }
  return <Modal titleId="new-ticket-title" onClose={onClose} busy={loading}>
    <div className="modal-header"><div><span className="eyebrow">NEW REQUEST</span><h2 id="new-ticket-title">What can we help with?</h2></div><button className="icon-button" aria-label="Close new ticket" disabled={loading} onClick={onClose}>×</button></div>
    <form onSubmit={submit}>
      <label>Your name<input required minLength="2" maxLength="80" disabled={loading} value={form.requester} onChange={(event) => setForm({ ...form, requester: event.target.value })} placeholder="Jordan Lee" /></label>
      <label>Short title<input required minLength="4" maxLength="200" disabled={loading} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Cannot connect to office Wi-Fi" /></label>
      <label>Describe the problem<textarea required minLength="12" maxLength="10000" disabled={loading} rows="6" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Tell us what happened, what you expected, and anything you already tried." /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={loading} onClick={onClose}>Cancel</button><button className="primary-button" disabled={loading}>{loading ? "Analyzing…" : "Create & triage"}</button></div>
    </form>
  </Modal>;
}

function NewArticleModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: "", category: "Software", summary: "", steps: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const article = await api("/api/articles", { method: "POST", body: { ...form, steps: form.steps.split("\n").map((step) => step.trim()).filter(Boolean) } });
      onCreated(article);
    } catch (caught) { setError(caught.message); } finally { setLoading(false); }
  }
  return <Modal titleId="new-article-title" onClose={onClose} busy={loading}>
    <div className="modal-header"><div><span className="eyebrow">KNOWLEDGE BASE</span><h2 id="new-article-title">Create an article</h2></div><button className="icon-button" aria-label="Close new article" disabled={loading} onClick={onClose}>×</button></div>
    <form onSubmit={submit}>
      <label>Article title<input required minLength="5" maxLength="200" disabled={loading} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Troubleshoot a frozen application" /></label>
      <label>Category<select value={form.category} disabled={loading} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Software</option><option>Hardware</option><option>Networking</option><option>Account</option><option>Security</option><option>Other</option></select></label>
      <label>Short summary<input required minLength="10" maxLength="1000" disabled={loading} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="A quick description of this solution." /></label>
      <label>Steps — one per line<textarea required maxLength="30000" rows="7" disabled={loading} value={form.steps} onChange={(event) => setForm({ ...form, steps: event.target.value })} placeholder={"Confirm the exact error message\nRestart the application\nCheck for available updates"} /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={loading} onClick={onClose}>Cancel</button><button className="primary-button" disabled={loading}>{loading ? "Saving…" : "Publish article"}</button></div>
    </form>
  </Modal>;
}

function KnowledgeBase({ articles, loading, onRefresh, onChanged, onDeleted, onNewArticle }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedId, setSelectedId] = useState(null);
  const [helpfulIds, setHelpfulIds] = useState(() => {
    const stored = readStored("resolve-helpful-articles", []);
    return Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : [];
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const visible = articles.filter((article) => (category === "All" || article.category === category) && `${article.title} ${article.summary} ${article.steps.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = visible.find((article) => article.id === selectedId) || visible[0];
  const date = (article) => new Date(article.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  async function removeArticle() {
    if (!selected || !window.confirm(`Delete “${selected.title}”?`)) return;
    setBusy(true); setError("");
    try { await api(`/api/articles/${selected.id}`, { method: "DELETE" }); onDeleted(selected.id); }
    catch (caught) { setError(caught.message); } finally { setBusy(false); }
  }
  async function markHelpful() {
    if (!selected || helpfulIds.includes(selected.id)) return;
    setBusy(true); setError("");
    try {
      onChanged(await api(`/api/articles/${selected.id}/helpful`, { method: "POST" }));
      const next = [...helpfulIds, selected.id]; setHelpfulIds(next);
      try { localStorage.setItem("resolve-helpful-articles", JSON.stringify(next)); } catch { /* The server feedback was already saved. */ }
    } catch (caught) { setError(caught.message); } finally { setBusy(false); }
  }
  return <section className="knowledge-layout">
    <div className="knowledge-list panel-card">
      <div className="panel-heading"><div><span className="eyebrow">DOCUMENTATION</span><h2>{articles.length} articles</h2></div><div className="inline-actions"><button className="icon-button" aria-label="Refresh articles" disabled={loading} onClick={onRefresh}>↻</button><button className="primary-button small-button" onClick={onNewArticle}>+ Add</button></div></div>
      <div className="filters"><input aria-label="Search articles" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search solutions…" /><select aria-label="Filter article category" value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option><option>Software</option><option>Hardware</option><option>Networking</option><option>Account</option><option>Security</option><option>Other</option></select></div>
      <div className="article-list">{loading && <div className="empty-state" role="status">Loading articles…</div>}{visible.map((article) => <button key={article.id} className={`article-card ${selected?.id === article.id ? "selected" : ""}`} onClick={() => setSelectedId(article.id)}><span className="article-category">{article.category}</span><strong>{article.title}</strong><p>{article.summary}</p><small>Updated {date(article)}</small></button>)}{!loading && !visible.length && <div className="empty-state">No articles match your search.</div>}</div>
    </div>
    <article className="article-detail panel-card">
      {error && <div className="form-error" role="alert">{error}</div>}
      {!selected ? <div className="empty-detail"><h2>No matching article</h2><p>Choose another filter or add a solution.</p></div> : <><div className="article-hero"><span className="article-category">{selected.category}</span><h2>{selected.title}</h2><p>{selected.summary}</p><small>Last updated {date(selected)}</small></div><div className="article-content"><span className="eyebrow">RESOLUTION STEPS</span><ol>{selected.steps.map((step, index) => <li key={`${selected.id}-${index}`}><span>{index + 1}</span><p>{step}</p></li>)}</ol></div><div className="article-footer"><span>{selected.helpfulCount} helpful {selected.helpfulCount === 1 ? "vote" : "votes"}</span><div><button className="secondary-button" disabled={busy || helpfulIds.includes(selected.id)} onClick={markHelpful}>{helpfulIds.includes(selected.id) ? "✓ Helpful" : "Mark helpful"}</button><button className="danger-button" disabled={busy} onClick={removeArticle}>Delete</button></div></div></>}
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
      <article className="panel-card analytics-card wide-card"><div className="card-title"><span className="eyebrow">PIPELINE</span><h2>Current ticket status</h2></div><div className="status-metrics"><div><span className="metric-dot open" /><strong>{tickets.filter((ticket) => ticket.status === "New").length}</strong><small>New</small></div><div><span className="metric-dot progress" /><strong>{tickets.filter((ticket) => ticket.status === "In Progress").length}</strong><small>In progress</small></div><div><span className="metric-dot waiting" /><strong>{tickets.filter((ticket) => ticket.status === "Waiting").length}</strong><small>Waiting</small></div><div><span className="metric-dot resolved" /><strong>{resolved}</strong><small>Resolved</small></div></div></article>
    </section>
  </>;
}

function Toggle({ checked, onChange, label }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><span /></button>;
}

function Settings({ settings, setSettings, aiInfo, refreshAI }) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  function changeDraft(next) { setDraft(next); setSaved(false); setError(""); }
  function save(event) {
    event.preventDefault(); setError("");
    try { const next = { ...draft, analystName: draft.analystName.trim() }; if (!next.analystName) throw new Error("Enter a display name."); localStorage.setItem("resolve-settings", JSON.stringify(next)); setSettings(next); setSaved(true); }
    catch (caught) { setError(caught.message || "Preferences could not be saved in this browser."); }
  }
  return <section className="settings-grid">
    <form className="panel-card settings-card" onSubmit={save}>
      <div className="card-title"><span className="eyebrow">PREFERENCES</span><h2>Workspace settings</h2><p>These preferences are saved in this browser.</p></div>
      <div className="setting-field"><label>Display name<input required maxLength="80" value={draft.analystName} onChange={(event) => changeDraft({ ...draft, analystName: event.target.value })} /></label></div>
      <div className="setting-field"><label>Default ticket view<select value={draft.defaultStatus} onChange={(event) => changeDraft({ ...draft, defaultStatus: event.target.value })}><option>All</option><option>New</option><option>In Progress</option><option>Waiting</option><option>Resolved</option></select></label></div>
      <div className="setting-row"><div><strong>Compact ticket list</strong><p>Show more tickets with less spacing.</p></div><Toggle label="Compact ticket list" checked={draft.compactMode} onChange={(value) => changeDraft({ ...draft, compactMode: value })} /></div>
      <div className="setting-row"><div><strong>High-priority alerts</strong><p>Highlight urgent requests in the command center.</p></div><Toggle label="High-priority alerts" checked={draft.highPriorityAlerts} onChange={(value) => changeDraft({ ...draft, highPriorityAlerts: value })} /></div>
      <div className="setting-row"><div><strong>Email notifications</strong><p>Available in a future update.</p></div></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="settings-actions"><button className="primary-button">{saved ? "✓ Saved" : "Save changes"}</button></div>
    </form>
    <aside className="panel-card connection-card">
      <div className="card-title"><span className="eyebrow">INTEGRATION</span><h2>AI connection</h2></div>
      <div className={`connection-status ${aiInfo.enabled ? "connected" : "offline"}`}><span className="status-dot" /><div><strong>{aiInfo.enabled ? "OpenAI configured" : "Local fallback active"}</strong><p>{aiInfo.enabled ? "New and re-triaged tickets use the OpenAI API." : "Resolve works locally until an API key is added."}</p></div></div>
      <dl><div><dt>Model</dt><dd>{aiInfo.model || "gpt-4o-mini"}</dd></div><div><dt>API key</dt><dd>{aiInfo.enabled ? "Configured" : "Not configured"}</dd></div><div><dt>Key location</dt><dd>server/.env</dd></div></dl>
      <button className="secondary-button full-button" onClick={refreshAI}>↻ Refresh AI status</button>
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

function initialSettings() {
  const stored = readStored("resolve-settings", {});
  const status = stored?.defaultStatus === "Open" ? "New" : stored?.defaultStatus;
  return {
    ...defaultSettings,
    analystName: typeof stored?.analystName === "string" && stored.analystName.trim() ? stored.analystName.trim().slice(0, 80) : defaultSettings.analystName,
    defaultStatus: ["All", "New", "In Progress", "Waiting", "Resolved"].includes(status) ? status : "All",
    compactMode: typeof stored?.compactMode === "boolean" ? stored.compactMode : false,
    highPriorityAlerts: typeof stored?.highPriorityAlerts === "boolean" ? stored.highPriorityAlerts : true,
  };
}

export default function App() {
  const [view, setView] = useState("dashboard");
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState(initialSettings);
  const [statusFilter, setStatusFilter] = useState(() => initialSettings().defaultStatus);
  const [articles, setArticles] = useState([]);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [queueReset, setQueueReset] = useState(0);
  const [aiInfo, setAiInfo] = useState({ enabled: false, model: "Loading…" });
  const articleRequest = useRef(null);

  async function loadTickets() {
    setLoading(true); setError("");
    try {
      const data = await api("/api/tickets");
      setTickets(data); setSelectedId((current) => data.some((ticket) => ticket.id === current) ? current : data[0]?.id ?? null);
    } catch (caught) { setError(caught.message); } finally { setLoading(false); }
  }
  async function loadArticles() {
    setArticlesLoading(true);
    if (!articleRequest.current) articleRequest.current = (async () => {
      const existing = await api("/api/articles");
      const legacy = readStored("resolve-articles", null);
      if (!Array.isArray(legacy) || !legacy.length) return existing;
      try {
        for (let index = 0; index < legacy.length; index += 20) await api("/api/articles/import", { method: "POST", body: { articles: legacy.slice(index, index + 20) } });
        try { localStorage.setItem("resolve-articles-backup", JSON.stringify(legacy)); localStorage.removeItem("resolve-articles"); } catch { /* Retain the old copy; importing again is safe. */ }
        return await api("/api/articles");
      } catch (caught) { setError(`Older articles remain saved on this device. ${caught.message}`); return existing; }
    })();
    try { setArticles(await articleRequest.current); }
    catch (caught) { setError(caught.message); }
    finally { setArticlesLoading(false); articleRequest.current = null; }
  }
  async function refreshAI() {
    try { setAiInfo(await api("/api/ai/status")); }
    catch { setAiInfo({ enabled: false, model: "Unavailable" }); }
  }
  useEffect(() => { loadTickets(); loadArticles(); refreshAI(); }, []);
  useEffect(() => { setStatusFilter(settings.defaultStatus); }, [settings.defaultStatus]);
  function updateTicket(updated) { setTickets((current) => current.map((ticket) => ticket.id === updated.id ? updated : ticket)); }
  function updateArticle(updated) { setArticles((current) => current.map((article) => article.id === updated.id ? updated : article)); }
  const copy = pageCopy[view];
  const navItems = [["dashboard", "⌁", "Command center"], ["knowledge", "◎", "Knowledge base"], ["analytics", "◫", "Analytics"], ["settings", "⚙", "Settings"]];
  const initials = settings.analystName.split(" ").map((part) => part[0] || "").join("").slice(0, 2).toUpperCase();

  return <div className={`app-shell ${settings.compactMode ? "compact-mode" : ""}`}>
    <aside className="sidebar">
      <div className="brand"><Logo /><div><strong>Resolve</strong><span>Support intelligence</span></div></div>
      <nav aria-label="Primary navigation">{navItems.map(([id, icon, label]) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}><span>{icon}</span>{label}</button>)}</nav>
      <div className={`ai-card ${aiInfo.enabled ? "online" : "fallback"}`}><div className="status-row"><span className="status-dot" /><strong>{aiInfo.enabled ? "OpenAI configured" : "Local fallback"}</strong></div><p>{aiInfo.enabled ? "AI triage is enabled for new tickets." : "Ticket triage runs locally."}</p></div>
      <div className="profile"><span>{initials}</span><div><strong>{settings.analystName}</strong><small>Support workspace</small></div></div>
    </aside>
    <main>
      <header><div><span className="eyebrow">{copy[0]}</span><h1>{copy[1]}</h1><p>{copy[2]}</p></div>{view === "dashboard" && <button className="primary-button" onClick={() => setShowTicketModal(true)}>+ New ticket</button>}{view === "knowledge" && <button className="primary-button" onClick={() => setShowArticleModal(true)}>+ New article</button>}</header>
      {error && <div className="banner-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
      {notice && <div className="banner-success" role="status">{notice}<button aria-label="Dismiss confirmation" onClick={() => setNotice("")}>×</button></div>}
      {view === "dashboard" && <TicketWorkspace key={queueReset} tickets={tickets} selectedId={selectedId} onSelect={setSelectedId} loading={loading} onRefresh={loadTickets} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} settings={settings} onUpdated={updateTicket} onNotice={setNotice} />}
      {view === "knowledge" && <KnowledgeBase articles={articles} loading={articlesLoading} onRefresh={loadArticles} onChanged={updateArticle} onDeleted={(id) => { setArticles((current) => current.filter((article) => article.id !== id)); setNotice("Article deleted."); }} onNewArticle={() => setShowArticleModal(true)} />}
      {view === "analytics" && <Analytics tickets={tickets} />}
      {view === "settings" && <Settings settings={settings} setSettings={setSettings} aiInfo={aiInfo} refreshAI={refreshAI} />}
    </main>
    {showTicketModal && <NewTicketModal onClose={() => setShowTicketModal(false)} onCreated={(ticket) => { setTickets((current) => [ticket, ...current]); setSelectedId(ticket.id); setSearch(""); setStatusFilter("All"); setQueueReset((current) => current + 1); setShowTicketModal(false); setNotice(`Ticket #${ticket.id} created.`); }} />}
    {showArticleModal && <NewArticleModal onClose={() => setShowArticleModal(false)} onCreated={(article) => { setArticles((current) => [article, ...current]); setShowArticleModal(false); setNotice("Article published."); }} />}
  </div>;
}
