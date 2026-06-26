// pages/index.js
// Sales Comp Week '26 - Registration Tracker dashboard.

import { useEffect, useState } from "react";

// Everstage brand palette - extracted from everstage.com CSS (2026 refresh)
// Dark nav: rgb(65,25,45)=#41192d | CTA button: rgb(248,150,80)=#f89650
// Teal (logo): #48c39e | Body bg: #fafaf7 | Text on dark: #fafaf7
const C = {
  bg:      "#150910",  // deeper than navbar, true dark base
  card:    "#2c1420",  // dark maroon card surface
  cardAlt: "#38192a",  // alternate row
  border:  "#5a2840",  // maroon border
  text:    "#fafaf7",  // warm white (brand: text on dark sections)
  sub:     "#c4a8b0",  // warm muted rose-grey
  accent:  "#f89650",  // brand orange (exact: rgb(248,150,80))
  up:      "#48c39e",  // medium-aquamarine (brand palette)
  down:    "#e05858",  // red
  tag:     "#41192d",  // navbar maroon (used for pills/tags)
};

// Brand logo colours for the accent stripe
const BRAND_STRIPE = ["#f89650", "#48c39e", "#2365ff", "#e84f7c"];

function fmtDate(iso) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
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
    // translate="no" prevents Chrome from auto-translating the dashboard
    <div translate="no" lang="en" style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
              {BRAND_STRIPE.map((col) => (
                <div key={col} style={{ height: 4, width: 32, borderRadius: 3, background: col }} />
              ))}
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: C.text }}>
              Sales Comp Week &apos;26 &mdash; Registration Tracker
            </h1>
            <p style={{ margin: "6px 0 0", color: C.sub, fontSize: 14 }}>
              Live channel-level registrations &nbsp;&bull;&nbsp; Sessions: Jun 23 &bull; Jul 7 &bull; Jul 9
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
            {data && <span style={{ color: C.sub, fontSize: 12 }}>Updated {fmtDate(data.updatedAt)}</span>}
            <button onClick={load} disabled={loading}
              style={{ background: C.accent, color: "#13110e", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 800, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1, letterSpacing: "0.02em" }}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#2a0a0a", border: `1px solid ${C.down}`, color: "#ffd0d0", borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <strong>Could not load data.</strong> {error}
          </div>
        )}

        {loading && !data && <p style={{ color: C.sub }}>Loading live numbers from HubSpot...</p>}

        {data && (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>
              <Stat label="Total Registrants"   value={data.total}          accent={C.accent} />
              <Stat label="This Week"           value={data.thisWeek}       accent={C.accent} />
              <Stat label="Active Channels"     value={data.activeChannels} accent={C.accent} />
              {data.sessions.slice(1).map((s, i) => {
                const d = Math.max(0, Math.ceil((Date.parse(s.date) - Date.now()) / 86400000));
                return <Stat key={s.id} label={"Days to Session " + (i + 2)} value={d} accent={C.accent} />;
              })}
            </div>

            {/* Filtered submissions callout */}
            {data.filteredStats && data.filteredStats.total > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1e1008", border: "1px solid #5a3810", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
                <span style={{ fontSize: 15, color: "#f8c080" }}>!</span>
                <div>
                  <span style={{ color: "#f8c080", fontWeight: 700 }}>
                    {data.filteredStats.total} submission{data.filteredStats.total !== 1 ? "s" : ""} excluded from count
                  </span>
                  <span style={{ color: C.sub, marginLeft: 10 }}>
                    {data.filteredStats.everstage > 0 && `${data.filteredStats.everstage} @everstage.com (internal testing)`}
                    {data.filteredStats.everstage > 0 && data.filteredStats.noEmail > 0 && "  |  "}
                    {data.filteredStats.noEmail > 0 && `${data.filteredStats.noEmail} no-email / no-record contacts`}
                  </span>
                  <span style={{ color: "#7a6050", marginLeft: 10 }}>
                    ({data.filteredStats.rawTotal} raw =&gt; {data.total} counted)
                  </span>
                </div>
              </div>
            )}

            {/* Week-over-Week table */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "auto", marginBottom: 24 }}>
              <div style={{ padding: "16px 20px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.sub, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Channel Breakdown - Week over Week
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#200e18" }}>
                    <th style={thLeft}>Channel</th>
                    {data.weeks.map((w, wi) => (
                      <th key={w.label} style={{
                        ...th,
                        background: w.sessions.length > 0 ? "#2e1428" : "#200e18",
                        borderLeft: wi === 0 ? "none" : `1px solid ${C.border}`,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: C.text, letterSpacing: "0.02em" }}>
                          {w.label.split(" ")[0]}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: C.sub, marginTop: 2 }}>
                          {w.label.split(" ").slice(1).join(" ")}
                        </div>
                        {w.sessions.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            {w.sessions.map((s) => (
                              <span key={s} style={sessionPill}>{s}</span>
                            ))}
                          </div>
                        )}
                      </th>
                    ))}
                    <th style={{ ...th, background: "#200e18", borderLeft: `1px solid ${C.border}`, color: C.text, fontWeight: 800 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.channels.map((ch, ri) => (
                    <tr key={ch} style={{ background: ri % 2 ? C.cardAlt : "transparent" }}>
                      <td style={tdLeft}>{ch}</td>
                      {data.matrix[ri].map((n, ci) => (
                        <td key={ci} style={{ ...td, color: n ? C.text : "#4a3040", borderLeft: ci === 0 ? "none" : "1px solid #3a1828" }}>
                          {n > 0 ? n : "-"}
                        </td>
                      ))}
                      <td style={{ ...td, fontWeight: 800, color: C.accent, borderLeft: `1px solid ${C.border}` }}>
                        {data.channelTotals[ri]}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${C.border}`, background: "#200e18" }}>
                    <td style={{ ...tdLeft, fontWeight: 800, color: C.text, background: "#200e18" }}>Weekly total</td>
                    {data.weekTotals.map((n, ci) => (
                      <td key={ci} style={{ ...td, fontWeight: 800, color: C.text, borderLeft: ci === 0 ? "none" : `1px solid ${C.border}` }}>
                        {n}
                        {data.wowPct[ci] != null && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: data.wowPct[ci] >= 0 ? C.up : C.down, marginTop: 2 }}>
                            {data.wowPct[ci] >= 0 ? "(+)" : "(-)"} {Math.abs(data.wowPct[ci])}%
                          </div>
                        )}
                      </td>
                    ))}
                    <td style={{ ...td, fontWeight: 800, color: C.accent, borderLeft: `1px solid ${C.border}` }}>{data.total}</td>
                  </tr>
                  <tr style={{ background: "transparent" }}>
                    <td style={{ ...tdLeft, color: C.sub, fontSize: 12, background: "transparent" }}>Cumulative</td>
                    {data.cumTotals.map((n, ci) => (
                      <td key={ci} style={{ ...td, color: C.sub, fontSize: 12, borderLeft: ci === 0 ? "none" : "1px solid #3a1828" }}>{n}</td>
                    ))}
                    <td style={{ ...td, borderLeft: `1px solid ${C.border}` }} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Daily registration detail */}
            {data.weekDailyBreakdown && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 24 }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.sub, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Daily Registration Inflow
                  </span>
                  <span style={{ fontSize: 12, color: "#6a4858", marginLeft: 10 }}>registrations per calendar day within each week</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <div style={{ display: "flex", minWidth: "max-content", padding: "16px 20px", gap: 12 }}>
                    {data.weekDailyBreakdown.map((days, wi) => {
                      const weekTotal = days.reduce((s, d) => s + d.count, 0);
                      const maxCount  = Math.max(...days.map((d) => d.count), 1);
                      return (
                        <div key={wi} style={{ minWidth: 120, background: "#200e18", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                          {/* Week header */}
                          <div style={{ padding: "8px 10px", background: "#2e1428", borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: C.text }}>{data.weeks[wi].label.split(" ")[0]}</div>
                            <div style={{ fontSize: 10, color: C.sub }}>{data.weeks[wi].label.split(" ").slice(1).join(" ")}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginTop: 3 }}>
                              {weekTotal} {weekTotal === 1 ? "sign-up" : "sign-ups"}
                            </div>
                          </div>
                          {/* Day rows */}
                          {days.map((day) => (
                            <div key={day.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderBottom: "1px solid #2a1020" }}>
                              <span style={{ fontSize: 11, color: day.count > 0 ? C.sub : "#4a3040", whiteSpace: "nowrap" }}>{day.label}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                                {day.count > 0 && (
                                  <div style={{ height: 6, width: Math.round((day.count / maxCount) * 36), minWidth: 4, background: C.accent, borderRadius: 3, opacity: 0.85 }} />
                                )}
                                <span style={{ fontSize: 12, fontWeight: 700, color: day.count > 0 ? C.text : "#4a3040", minWidth: 16, textAlign: "right" }}>
                                  {day.count > 0 ? day.count : "-"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Session schedule */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.sub, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
                Session Schedule
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                {data.sessions.map((s, i) => {
                  const daysLeft = Math.max(0, Math.ceil((Date.parse(s.date) - Date.now()) / 86400000));
                  const past = daysLeft === 0;
                  return (
                    <div key={s.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", borderTop: `3px solid ${past ? C.up : C.accent}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ color: C.accent, fontWeight: 800, fontSize: 12, letterSpacing: "0.05em" }}>SESSION {i + 1} | {s.id}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: past ? C.up : C.sub, background: past ? "#0d2820" : "#200e18", padding: "3px 8px", borderRadius: 20 }}>
                          {past ? "Live" : `${daysLeft}d away`}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{s.title}</div>
                      <div style={{ color: C.sub, fontSize: 13 }}>
                        {new Date(s.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ background: "#2c1420", border: "1px solid #5a2840", borderRadius: 12, padding: "18px 20px", borderTop: `3px solid ${accent}` }}>
      <div style={{ color: "#c4a8b0", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 800, color: "#fafaf7", letterSpacing: "-1px" }}>{value}</div>
    </div>
  );
}

const th      = { padding: "10px 12px", textAlign: "center", fontWeight: 700, whiteSpace: "nowrap", verticalAlign: "bottom" };
const thLeft  = { ...th, textAlign: "left", position: "sticky", left: 0, background: "#200e18", minWidth: 200, paddingLeft: 20 };
const td      = { padding: "10px 12px", textAlign: "center", borderBottom: "1px solid #2a1020" };
const tdLeft  = { ...td, textAlign: "left", position: "sticky", left: 0, background: "inherit", maxWidth: 260, paddingLeft: 20 };
const sessionPill = { display: "inline-block", background: "#f89650", color: "#13110e", fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "2px 6px", marginTop: 4, letterSpacing: "0.04em" };
