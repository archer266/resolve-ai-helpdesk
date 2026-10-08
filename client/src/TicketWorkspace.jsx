import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const statuses = ["New", "In Progress", "Waiting", "Resolved"];
const priorities = ["Low", "Medium", "High", "Critical"];

function relativeTime(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
const statusClass = (status) => status.toLowerCase().replaceAll(" ", "-");

function TicketDetail({ ticket, analystName, onUpdated, onNotice }) {
  const [draft, setDraft] = useState({ status: ticket.status, priority: ticket.priority, assignedTo: ticket.assignedTo });
  const [tab, setTab] = useState("conversation");
  const [comment, setComment] = useState("");
  const [commentType, setCommentType] = useState("reply");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft({ status: ticket.status, priority: ticket.priority, assignedTo: ticket.assignedTo });
  }, [ticket.status, ticket.priority, ticket.assignedTo]);
  const dirty = draft.status !== ticket.status || draft.priority !== ticket.priority || draft.assignedTo !== ticket.assignedTo;

  async function mutate(path, method, body, message, operation) {
    setBusy(operation); setError("");
    try {
      const updated = await api(path, { method, body: { ...body, author: analystName } });
      onUpdated(updated); onNotice(message);
      return true;
    } catch (caught) { setError(caught.message); return false; }
    finally { setBusy(""); }
  }
  function changeStatus(status) {
    return mutate(`/api/tickets/${ticket.id}`, "PATCH", { status }, `Ticket #${ticket.id} moved to ${status}.`, "status");
  }
  async function saveDetails(event) {
    event.preventDefault();
    await mutate(`/api/tickets/${ticket.id}`, "PATCH", draft, "Ticket details saved.", "details");
  }
  async function postComment(event) {
    event.preventDefault();
    if (!comment.trim()) return;
    if (await mutate(`/api/tickets/${ticket.id}/comments`, "POST", { body: comment, type: commentType }, commentType === "note" ? "Team note saved." : "Reply saved.", "comment")) setComment("");
  }
  const activities = ticket.activities || [];
  const entries = tab === "conversation" ? activities.filter((event) => ["reply", "note"].includes(event.type)) : activities;

  return <>
    <div className="detail-heading"><div><span className="ticket-id">TICKET #{String(ticket.id).padStart(4, "0")}</span><h2>{ticket.title}</h2><p>Submitted by {ticket.requester} · {relativeTime(ticket.createdAt)}</p></div><span className={`status-badge ${statusClass(ticket.status)}`}>{ticket.status}</span></div>
    <div className="detail-body">
      {error && <div className="form-error" role="alert">{error}</div>}
      <form className="ticket-properties" onSubmit={saveDetails}>
        <div className="property-grid">
          <label>Status<select aria-label="Ticket status" value={draft.status} disabled={Boolean(busy)} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Priority<select aria-label="Ticket priority" value={draft.priority} disabled={Boolean(busy)} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
        </div>
        <label>Assigned technician<input maxLength="80" value={draft.assignedTo} disabled={Boolean(busy)} onChange={(event) => setDraft({ ...draft, assignedTo: event.target.value })} placeholder="Unassigned" /></label>
        <div className="property-actions"><button type="button" className="text-button" disabled={Boolean(busy)} onClick={() => setDraft({ ...draft, assignedTo: analystName })}>Assign to me</button><button className="secondary-button small-button" disabled={Boolean(busy) || !dirty}>{busy === "details" ? "Saving…" : "Save details"}</button></div>
      </form>
      <section><span className="eyebrow">REQUEST</span><p className="description preserve-lines">{ticket.description}</p></section>
      <section className="triage-box">
        <div className="triage-title"><div><span className="spark">✦</span><span><strong>Resolve triage</strong><small>{ticket.triageSource === "openai" ? "Analyzed with OpenAI" : "Local fallback analysis"}</small></span></div><button disabled={Boolean(busy)} onClick={() => mutate(`/api/tickets/${ticket.id}/retriage`, "POST", {}, "Triage refreshed.", "triage")}>{busy === "triage" ? "Analyzing…" : "Run again"}</button></div>
        <div className="triage-grid"><div><span>CATEGORY</span><strong>{ticket.category}</strong></div><div><span>PRIORITY</span><strong className={`priority-text ${ticket.priority.toLowerCase()}`}>{ticket.priority}</strong></div><div><span>CONFIDENCE</span><strong>{Math.round(ticket.aiConfidence * 100)}%</strong></div></div>
        <div className="recommendation"><span>RECOMMENDED NEXT ACTION</span><p>{ticket.suggestedAction || "Review the request and collect any missing details."}</p></div>
      </section>
      <section><span className="eyebrow">TRIAGE SUMMARY</span><p className="description">{ticket.summary}</p></section>
      <section className="ticket-discussion">
        <div className="discussion-tabs" role="tablist" aria-label="Ticket activity">
          <button role="tab" aria-selected={tab === "conversation"} onClick={() => setTab("conversation")}>Conversation</button>
          <button role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>Activity history</button>
        </div>
        <div className="activity-feed" role="tabpanel" aria-label={tab === "history" ? "Activity history" : "Conversation"}>
          {!entries.length && <p className="discussion-empty">No replies yet. Add an update below.</p>}
          {entries.map((entry) => <article key={entry.id} className={`activity-entry ${entry.type}`}>
            <div><strong>{entry.author}</strong><span>{entry.type === "note" ? "Team note" : entry.type === "reply" ? "Reply" : "Update"}</span><time title={new Date(entry.createdAt).toLocaleString()}>{relativeTime(entry.createdAt)}</time></div>
            <p className="preserve-lines">{entry.body}</p>
          </article>)}
        </div>
        <form className="comment-form" onSubmit={postComment}>
          <label>Update type<select value={commentType} disabled={Boolean(busy)} onChange={(event) => setCommentType(event.target.value)}><option value="reply">Reply</option><option value="note">Team note</option></select></label>
          <label>{commentType === "note" ? "Team note" : "Reply"}<textarea required maxLength="5000" rows="3" value={comment} disabled={Boolean(busy)} onChange={(event) => setComment(event.target.value)} placeholder={commentType === "note" ? "Record your investigation or handoff details…" : "Add a progress update or a follow-up question…"} /></label>
          <div className="comment-actions"><small>Saved to this support workspace.</small><button className="primary-button small-button" disabled={Boolean(busy) || !comment.trim()}>{busy === "comment" ? "Saving…" : commentType === "note" ? "Add note" : "Add reply"}</button></div>
        </form>
      </section>
    </div>
    <div className="detail-actions">
      {ticket.status === "Resolved" ? <button className="secondary-button" disabled={Boolean(busy)} onClick={() => changeStatus("New")}>Reopen ticket</button> : <>
        {["New", "Waiting"].includes(ticket.status) && <button className="secondary-button" disabled={Boolean(busy)} onClick={() => changeStatus("In Progress")}>{ticket.status === "Waiting" ? "Resume work" : "Start work"}</button>}
        {ticket.status !== "Waiting" && <button className="secondary-button" disabled={Boolean(busy)} onClick={() => changeStatus("Waiting")}>Waiting on requester</button>}
        <button className="primary-button" disabled={Boolean(busy)} onClick={() => changeStatus("Resolved")}>✓ Mark resolved</button>
      </>}
    </div>
  </>;
}

export default function TicketWorkspace({ tickets, selectedId, onSelect, loading, onRefresh, search, setSearch, statusFilter, setStatusFilter, settings, onUpdated, onNotice }) {
  const [queueFilter, setQueueFilter] = useState("all");
  const visible = useMemo(() => tickets.filter((ticket) => {
    const text = `${ticket.id} ${ticket.title} ${ticket.requester} ${ticket.category} ${ticket.description} ${ticket.assignedTo}`.toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (statusFilter === "All" || ticket.status === statusFilter)
      && (queueFilter !== "mine" || ticket.assignedTo === settings.analystName)
      && (queueFilter !== "unassigned" || !ticket.assignedTo);
  }), [tickets, search, statusFilter, queueFilter, settings.analystName]);
  // The detail panel and its mutations always use a ticket visible in the current queue.
  const activeTicket = visible.find((ticket) => ticket.id === selectedId) || visible[0];
  const active = tickets.filter((ticket) => ticket.status !== "Resolved");
  const urgent = active.filter((ticket) => ["High", "Critical"].includes(ticket.priority)).length;
  const stats = [
    ["ACTIVE TICKETS", active.length, "Requests in the queue"],
    ["HIGH PRIORITY", urgent, "Needs attention"],
    ["WAITING", active.filter((ticket) => ticket.status === "Waiting").length, "Awaiting a response"],
    ["UNASSIGNED", active.filter((ticket) => !ticket.assignedTo).length, "Ready for an owner"],
  ];
  return <>
    <section className="stats-grid">{stats.map(([label, value, subtitle]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{subtitle}</small></article>)}</section>
    {settings.highPriorityAlerts && urgent > 0 && <div className="priority-alert"><span>{urgent} high-priority {urgent === 1 ? "request needs" : "requests need"} attention.</span><button className="text-button" onClick={() => { setSearch(""); setStatusFilter("All"); setQueueFilter("all"); const ticket = active.find((item) => ["High", "Critical"].includes(item.priority)); onSelect(ticket.id); }}>View request</button></div>}
    <section className="workspace">
      <div className="queue-panel">
        <div className="panel-heading"><div><span className="eyebrow">INBOX · {visible.length} TICKETS</span><h2>Ticket queue</h2></div><button className="icon-button" aria-label="Refresh tickets" disabled={loading} onClick={onRefresh}>↻</button></div>
        <div className="queue-tabs">{[["all", "All tickets"], ["mine", "Assigned to me"], ["unassigned", "Unassigned"]].map(([id, label]) => <button key={id} aria-pressed={queueFilter === id} onClick={() => setQueueFilter(id)}>{label}</button>)}</div>
        <div className="filters"><input aria-label="Search tickets" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets…" /><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>
        <div className="ticket-list">
          {loading && <div className="empty-state" role="status">Loading tickets…</div>}
          {!loading && !visible.length && <div className="empty-state">No tickets match this view.</div>}
          {visible.map((ticket) => <button key={ticket.id} className={`ticket-card ${activeTicket?.id === ticket.id ? "selected" : ""}`} onClick={() => onSelect(ticket.id)}>
            <div className="ticket-topline"><span className="ticket-id">#{String(ticket.id).padStart(4, "0")}</span><span className={`priority ${ticket.priority.toLowerCase()}`}>{ticket.priority}</span></div>
            <strong>{ticket.title}</strong><p>{ticket.summary || ticket.description}</p>
            <div className="ticket-meta"><span>{ticket.category}</span><span>{relativeTime(ticket.createdAt)}</span></div>
            <div className="ticket-owner"><span className={`status-badge ${statusClass(ticket.status)}`}>{ticket.status}</span><span>{ticket.assignedTo || "Unassigned"}</span></div>
          </button>)}
        </div>
      </div>
      <div className="detail-panel">{activeTicket ? <TicketDetail key={activeTicket.id} ticket={activeTicket} analystName={settings.analystName} onUpdated={onUpdated} onNotice={onNotice} /> : <div className="empty-detail"><h2>No matching ticket</h2><p>Choose another filter or create a new request.</p></div>}</div>
    </section>
  </>;
}
