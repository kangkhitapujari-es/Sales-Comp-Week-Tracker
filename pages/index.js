// pages/index.js
// Sales Comp Week '26 — Registration Tracker dashboard.
// Pulls live data from /api/registrations and renders stat cards, a
// channel x week table with WoW % change, and the session schedule.

import { useEffect, useState } from "react";

// New Everstage brand palette (refreshed 2026)
const C = {
  bg:      "#1c0a2e",  // deep dark purple
  card:    "#2b1245",  // card surface
  cardAlt: "#321650",  // alternate table row
  border:  "#4e2478",  // subtle border
  text:    "#f4ead8",  // warm cream
  sub:     "#b09db8",  // muted purple-grey
  accent:  "#e8751c",  // amber/orange (matches CTA button)
  up:      "#3ecf8e",  // positive WoW
  down:    "#ff6060",  // negative WoW
};

function fmtDate(iso) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Home() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const REFRESH_SECONDS = 60;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/registrations", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_SECONDS * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
          <div>
            {/* Everstage brand accent stripe */}
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {["#e8751c","#e84f7c","#9b59e8","#3b9be8","#3ecf8e"].map((col) => (
                <div key={col} style={{ height: 3, width: 28, borderRadius: 2, background: col }} />
              ))}
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: C.text }}>
              Sales Comp Week '26 — Registration Tracker
            </h1>
            <p style={{ margin: "6px 0 0", color: C.sub, fontSize: 14 }}>
              Live channel-level week-over-week sign-ups · Jun 23 · Jul 7 · Jul 9
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {data && (
              <span style={{ color: C.sub, fontSize: 12 }}>Updated {fmtDate(data.updatedAt)}</span>
            )}
            <button
              onClick={load}
              disabled={loading}
              style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1, letterSpacing: "0.03em" }}
            >
              {loading ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#3a1010", border: `1px solid ${C.down}`, color: "#ffd0d0", borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <strong>Couldn't load data.</strong> {error}
          </div>
        )}

        {loading && !data && (
          <p style={{ color: C.sub }}>Loading live numbers from HubSpot…</p>
        )}

        {data && (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
              <Stat label="Total registrants"  value={data.total} />
              <Stat label="This week"          value={data.thisWeek} />
              <Stat label="Active channels"    value={data.activeChannels} />
              <Stat label="Days to Session 1"  value={data.daysToS1} />
            </div>

            {/* WoW table */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "auto", marginBottom: 28 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thLeft}>Channel</th>
                    {data.weeks.map((w) => (
                      <th key={w.label} style={th}>
                        <div>{w.label}</div>
                        {w.sessions.length > 0 && (
                          <div style={{ marginTop: 3 }}>
                            {w.sessions.map((s) => (
                              <span key={s} style={sessionPill}>{s}</span>
                            ))}
                          </div>
                        )}
                      </th>
                    ))}
                    <th style={th}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.channels.map((ch, ri) => (
                    <tr key={ch} style={{ background: ri % 2 ? C.cardAlt : "transparent" }}>
                      <td style={tdLeft}>{ch}</td>
                      {data.matrix[ri].map((n, ci) => (
                        <td key={ci} style={{ ...td, color: n ? C.text : C.sub }}>{n || "·"}</td>
                      ))}
                      <td style={{ ...td, fontWeight: 700 }}>{data.channelTotals[ri]}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${C.border}` }}>
                    <td style={{ ...tdLeft, fontWeight: 700 }}>Weekly total</td>
                    {data.weekTotals.map((n, ci) => (
                      <td key={ci} style={{ ...td, fontWeight: 700 }}>
                        {n}
                        {data.wowPct[ci] != null && (
                          <div style={{ fontSize: 11, color: data.wowPct[ci] >= 0 ? C.up : C.down }}>
                            {data.wowPct[ci] >= 0 ? "▲" : "▼"} {Math.abs(data.wowPct[ci])}%
                          </div>
                        )}
                      </td>
                    ))}
                    <td style={{ ...td, fontWeight: 700 }}>{data.total}</td>
                  </tr>
                  <tr>
                    <td style={{ ...tdLeft, color: C.sub }}>Cumulative</td>
                    {data.cumTotals.map((n, ci) => (
                      <td key={ci} style={{ ...td, color: C.sub }}>{n}</td>
                    ))}
                    <td style={td} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Session schedule */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              {data.sessions.map((s, i) => {
                const days = Math.max(0, Math.ceil((Date.parse(s.date) - Date.now()) / 86400000));
                return (
                  <div
                    key={s.id}
                    style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, borderTop: `3px solid ${C.accent}` }}
                  >
                    <div style={{ color: C.accent, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                      Session {i + 1} · {s.id}
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
                    <div style={{ color: C.sub, fontSize: 13 }}>
                      {new Date(s.date).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
                    </div>
                    <div style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>
                      {days === 0 ? "Today / passed" : `${days} days away`}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ color: C.sub, fontSize: 13, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: C.text }}>{value}</div>
    </div>
  );
}

const th      = { padding: "12px 10px", textAlign: "center", color: "#c4b8d4", fontWeight: 600, borderBottom: `1px solid #4e2478`, whiteSpace: "nowrap" };
const thLeft  = { ...th, textAlign: "left", position: "sticky", left: 0, background: C.card };
const td      = { padding: "10px", textAlign: "center", borderBottom: `1px solid #3d1860` };
const tdLeft  = { ...td, textAlign: "left", position: "sticky", left: 0, background: "inherit", maxWidth: 260 };
const sessionPill = { display: "inline-block", background: "#e8751c", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "1px 6px", marginLeft: 2 };
