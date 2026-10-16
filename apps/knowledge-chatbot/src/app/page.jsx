"use client";

import { useEffect, useRef, useState } from "react";

const initialMessage = {
  role: "assistant",
  content: "Hi, I’m your source-grounded assistant. Ask a question and I’ll answer from the indexed sources, with citations you can open.",
  sources: [],
};

export default function Home() {
  const [messages, setMessages] = useState([initialMessage]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [adminToken, setAdminToken] = useState("");
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const endRef = useRef(null);

  async function refresh() {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setStatus(data);
        setDocuments(data.documents || []);
      }
    } catch { /* The app remains usable while status is unavailable. */ }
  }

  useEffect(() => { refresh(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    const prior = messages.slice(1).map(({ role, content }) => ({ role, content }));
    setQuestion("");
    setMessages((current) => [...current, { role: "user", content: text }]);
    setBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: prior }),
      });
      const data = await response.json();
      setMessages((current) => [...current, {
        role: "assistant", content: data.answer || data.error || "The answer could not be completed.",
        sources: data.sources || [], verified: data.verified,
      }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: "I couldn’t reach the server. Please try again.", sources: [] }]);
    } finally { setBusy(false); }
  }

  async function ingest(event) {
    event.preventDefault();
    setAdminBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + adminToken },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add this source.");
      setNotice("Added “" + data.title + "” · " + data.chunks + " passages indexed.");
      setUrl("");
      await refresh();
    } catch (error) { setNotice(error.message); }
    finally { setAdminBusy(false); }
  }

  async function removeAll() {
    if (!window.confirm("Remove every indexed source? This cannot be undone.")) return;
    setAdminBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/documents", {
        method: "DELETE", headers: { Authorization: "Bearer " + adminToken },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not clear the knowledge base.");
      setNotice("Knowledge base cleared."); await refresh();
    } catch (error) { setNotice(error.message); }
    finally { setAdminBusy(false); }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="S-AI Knowledge Chat home"><span className="brand-mark">S</span><span>S-AI <span className="brand-muted">/ KNOWLEDGE</span></span></a>
        <div className="top-meta"><span className={status?.providers?.available?.length ? "status-dot online" : "status-dot"} />{status?.providers?.available?.length ? "Assistant ready" : "Provider setup needed"}</div>
      </header>

      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-line" />A grounded knowledge assistant</div>
        <h1>Good answers have<br /><em>good sources.</em></h1>
        <p>Ask about the indexed material. Each answer is checked against its sources before it reaches you.</p>
        <div className="hero-stats">
          <div><strong>{documents.length}</strong><span>indexed sources</span></div>
          <div><strong>{status?.providers?.available?.length || 0}</strong><span>active models</span></div>
          <div><strong>DUET</strong><span>answer review</span></div>
        </div>
      </section>

      <section className="workspace">
        <div className="chat-panel panel">
          <div className="panel-heading"><div><span className="section-index">01</span><h2>Ask a question</h2></div><span className="subtle">SOURCE-GROUNDED CHAT</span></div>
          <div className="messages" aria-live="polite">
            {messages.map((item, index) => <article className={"message " + item.role} key={index}>
              <div className="message-avatar">{item.role === "assistant" ? "S" : "Y"}</div>
              <div className="message-content"><span className="message-label">{item.role === "assistant" ? "S-AI ASSISTANT" : "YOU"}</span>
                <p>{item.content}</p>
                {item.role === "assistant" && item.sources?.length > 0 && <div className="citations"><span className="citation-label">SOURCES</span>{item.sources.map((source, i) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url + i}>[{i + 1}] {source.title}<span aria-hidden="true"> ↗</span></a>)}</div>}
                {item.verified === false && <span className="review-note">Could not verify from indexed sources</span>}
              </div>
            </article>)}
            {busy && <div className="thinking"><span /><span /><span />Checking sources and preparing an answer…</div>}
            <div ref={endRef} />
          </div>
          <form className="composer" onSubmit={send}>
            <label className="sr-only" htmlFor="question">Your question</label>
            <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask something about the indexed sources…" rows={2} maxLength={4000} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} />
            <div className="composer-footer"><span>Answers are reviewed and cited · Enter to send</span><button className="send-button" disabled={busy || !question.trim()} type="submit">Ask <span aria-hidden="true">↗</span></button></div>
          </form>
        </div>

        <aside className="side-column">
          <section className="panel source-panel">
            <div className="panel-heading"><div><span className="section-index">02</span><h2>Knowledge base</h2></div><span className="count-pill">{documents.length}</span></div>
            <p className="panel-intro">Answers draw only from these sources.</p>
            <ul className="source-list">{documents.length ? documents.map((doc) => <li key={doc.url}><span className="source-icon">↗</span><div><a href={doc.url} target="_blank" rel="noreferrer">{doc.title}</a><small>{doc.chunks} passages · {doc.trust}</small></div></li>) : <li className="empty-state">No sources indexed yet.</li>}</ul>
          </section>
          <section className="panel admin-panel">
            <div className="panel-heading"><div><span className="section-index">03</span><h2>Manage sources</h2></div><span className="lock-icon" aria-label="Admin access required">⌑</span></div>
            <p className="panel-intro">Enter the admin token to add a public webpage to the knowledge base.</p>
            <label className="field-label" htmlFor="admin-token">ADMIN TOKEN</label>
            <input id="admin-token" type="password" autoComplete="off" value={adminToken} onChange={(event) => setAdminToken(event.target.value)} placeholder="Paste admin token" />
            <form onSubmit={ingest} className="ingest-form">
              <label className="field-label" htmlFor="source-url">SOURCE URL</label>
              <input id="source-url" type="url" required maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/article" />
              <button className="outline-button" type="submit" disabled={adminBusy || !adminToken}>Add source <span>＋</span></button>
            </form>
            <button className="clear-button" type="button" disabled={adminBusy || !adminToken || documents.length === 0} onClick={removeAll}>Clear all indexed sources</button>
            {notice && <p className="notice" role="status">{notice}</p>}
          </section>
          <div className="privacy-note"><span>◈</span><p>Provider keys stay server-side. Sources are fetched with private-network protections and answers must pass citation review.</p></div>
        </aside>
      </section>
      <footer><span>S-AI KNOWLEDGE CHAT</span><span>{status?.storage?.persistent ? "PERSISTENT STORAGE" : "EPHEMERAL STORAGE"} · <a href="https://github.com/karun99/s-ai" target="_blank" rel="noreferrer">OPEN SOURCE ↗</a></span></footer>
    </main>
  );
}
