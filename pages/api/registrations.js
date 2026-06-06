// pages/api/registrations.js
// Sales Comp Week '26 — Registration Tracker
//
// Required HubSpot Private App scope: `forms`
// Token is read from the HUBSPOT_TOKEN env var (set in Vercel — never in code).

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const FORM_NAME = "[Webinar Registration] Sales Comp Week 2026: June - July";

const DAY_MS = 24 * 60 * 60 * 1000;

// ---- Weekly cohort ranges (UTC midnight, start inclusive / end exclusive) ----
const WEEK_RANGES = [
  [Date.UTC(2026, 4, 14), Date.UTC(2026, 4, 18)],  // W1 May 14–17
  [Date.UTC(2026, 4, 18), Date.UTC(2026, 4, 25)],  // W2 May 18–24
  [Date.UTC(2026, 4, 25), Date.UTC(2026, 5,  1)],  // W3 May 25–31
  [Date.UTC(2026, 5,  1), Date.UTC(2026, 5,  8)],  // W4 Jun 1–7
  [Date.UTC(2026, 5,  8), Date.UTC(2026, 5, 15)],  // W5 Jun 8–14
  [Date.UTC(2026, 5, 15), Date.UTC(2026, 5, 22)],  // W6 Jun 15–21
  [Date.UTC(2026, 5, 22), Date.UTC(2026, 5, 29)],  // W7 Jun 22–28
  [Date.UTC(2026, 5, 29), Date.UTC(2026, 6,  6)],  // W8 Jun 29–Jul 5
  [Date.UTC(2026, 6,  6), Date.UTC(2026, 6, 10)],  // W9 Jul 6–9
];
const TOTAL_WEEKS = WEEK_RANGES.length;

const SESSIONS = [
  { id: "S1", title: "The Mid-Year Comp Reset",       date: "2026-06-23" },
  { id: "S2", title: "The Comp Infrastructure Gap",   date: "2026-07-07" },
  { id: "S3", title: "The Comp Efficiency Paradox",   date: "2026-07-09" },
];

const UNKNOWN = "Direct / Unknown";

// ---- HubSpot helper -------------------------------------------------------
async function hs(path) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot ${res.status} on ${path}: ${body}`);
  }
  return res.json();
}

async function getFormId() {
  let after;
  do {
    const qs = after ? `?limit=100&after=${after}` : `?limit=100`;
    const data = await hs(`/marketing/v3/forms${qs}`);
    const match = (data.results || []).find((f) => f.name === FORM_NAME);
    if (match) return match.id;
    after = data.paging?.next?.after;
  } while (after);
  throw new Error(`Form not found: ${FORM_NAME}`);
}

async function getSubmissions(formId) {
  const out = [];
  let after;
  do {
    const qs = after ? `?limit=50&after=${after}` : `?limit=50`;
    const data = await hs(`/form-integrations/v1/submissions/forms/${formId}${qs}`);
    out.push(...(data.results || []));
    after = data.paging?.next?.after;
  } while (after);
  return out;
}

// ---- Email extraction -----------------------------------------------------
function getEmail(sub) {
  const field = (sub.values || []).find((v) => v.name === "email");
  return (field?.value || "").toLowerCase().trim() || null;
}

// ---- UTM parsing ----------------------------------------------------------
function parseUtms(pageUrl) {
  if (!pageUrl) return null;
  try {
    const params = new URL(pageUrl).searchParams;
    const source   = params.get("utm_source");
    const medium   = params.get("utm_medium");
    const campaign = params.get("utm_campaign");
    if (!source && !medium && !campaign) return null;
    return {
      source:   (source   || "(none)").toLowerCase().trim(),
      medium:   (medium   || "(none)").toLowerCase().trim(),
      campaign: (campaign || "(none)").toLowerCase().trim(),
    };
  } catch {
    return null;
  }
}

// ---- Channel mapping (priority order: most-specific first) ----------------
function mapToChannel(utm) {
  if (!utm) return UNKNOWN;
  const { campaign: c = "", medium: m = "", source: s = "" } = utm;

  if (c === "bdr" && m === "1-1-invites" && s === "linkedin") return "BDR LinkedIn Invites";
  if (c === "bdr" && m === "1-1-invites" && s === "email")    return "BDR Email Invites";
  if (c === "ae"  && m === "1-1" && s === "invites") return "AE Invites";
  if (c === "csm" && m === "1-1" && s === "invites") return "CSM Invites";
  if ((c === "kangkhita" || c === "jyothsna") && m === "1-1-reachouts" && s === "linkedin") return "LinkedIn 1-1 Invites";
  if (/^\w+-abm-\d+$/.test(c)    && m === "linkedin" && s === "organic-social") return "ABM BDR Organic Social";
  if (/^\w+-intent-\d+$/.test(c) && m === "linkedin" && s === "organic-social") return "Intent BDR Organic Social";
  if (/^(kelly|mike|siva|jose)-post-\d+$/.test(c)  && m === "linkedin" && s === "organic-social") return "Executive LinkedIn Organic";
  if (/^(matt|dillon)-post-\d+$/.test(c)            && m === "linkedin" && s === "organic-social") return "Session 1 Speakers LinkedIn Organic";
  if (/^(trenli|juan)-post-\d+$/.test(c)            && m === "linkedin" && s === "organic-social") return "Session 2 Speakers LinkedIn Organic";
  if (/^(nate|john)-post-\d+$/.test(c)              && m === "linkedin" && s === "organic-social") return "Session 3 Speakers LinkedIn Organic";
  if (/^post[\s-]?\d+$/.test(c) && m === "linkedin" && s === "organic-social") return "Everstage Organic Social";
  if (m === "paid" && s === "linkedin") return "LinkedIn Ads";
  if (m === "mailchimp" && s === "email")                        return "Mailchimp Email Blasts";
  if (c === "email-blast" && m === "community" && s === "roco")  return "ROCO Promotions";
  if (m === "slack" && s === "uncappd") return "Uncappd Slack Posts";
  if (c === "pop-up" && m === "notification" && s === "homepage") return "Homepage Hello Bar";
  return UNKNOWN;
}

// ---- Week helpers ---------------------------------------------------------
function weekIndex(tsMs) {
  for (let i = 0; i < WEEK_RANGES.length; i++) {
    if (tsMs >= WEEK_RANGES[i][0] && tsMs < WEEK_RANGES[i][1]) return i;
  }
  return tsMs < WEEK_RANGES[0][0] ? 0 : TOTAL_WEEKS - 1;
}

function weekLabel(i) {
  const [start, endExcl] = WEEK_RANGES[i];
  const startD = new Date(start);
  const endD   = new Date(endExcl - DAY_MS);
  const startStr = startD.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endStr   =
    startD.getUTCMonth() === endD.getUTCMonth()
      ? String(endD.getUTCDate())
      : endD.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `W${i + 1} ${startStr}–${endStr}`;
}

// ---- Handler --------------------------------------------------------------
export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (!HUBSPOT_TOKEN) throw new Error("HUBSPOT_TOKEN env var not set");

    const formId         = await getFormId();
    const rawSubmissions = await getSubmissions(formId);

    // Tally excluded submissions before filtering
    let filteredEverstage = 0;
    let filteredNoEmail   = 0;
    for (const sub of rawSubmissions) {
      const email = getEmail(sub);
      if (!email) filteredNoEmail++;
      else if (email.endsWith("@everstage.com")) filteredEverstage++;
    }

    const submissions = rawSubmissions.filter((sub) => {
      const email = getEmail(sub);
      if (!email) return false;
      if (email.endsWith("@everstage.com")) return false;
      return true;
    });

    // Week metadata
    const weeks = WEEK_RANGES.map((range, i) => ({
      label:    weekLabel(i),
      startISO: new Date(range[0]).toISOString().slice(0, 10),
      sessions: SESSIONS
        .filter((s) => { const sd = Date.parse(s.date); return sd >= range[0] && sd < range[1]; })
        .map((s) => s.id),
    }));

    // Aggregate: channel -> count per week
    const counts = {};
    // Daily counts: "YYYY-MM-DD" -> total count across all channels
    const dailyCounts = {};

    for (const sub of submissions) {
      const key  = mapToChannel(parseUtms(sub.pageUrl));
      const wi   = weekIndex(sub.submittedAt);
      (counts[key] ||= new Array(TOTAL_WEEKS).fill(0))[wi] += 1;

      const dateStr = new Date(sub.submittedAt).toISOString().slice(0, 10);
      dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
    }

    // Per-week daily breakdown: array of [{date, label, count}] per week
    const weekDailyBreakdown = WEEK_RANGES.map(([start, endExcl]) => {
      const days = [];
      for (let d = start; d < endExcl; d += DAY_MS) {
        const dateStr = new Date(d).toISOString().slice(0, 10);
        const label   = new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
        days.push({ date: dateStr, label, count: dailyCounts[dateStr] || 0 });
      }
      return days;
    });

    // Sort channels by total desc, keep Direct/Unknown last
    const channels = Object.keys(counts).sort((a, b) => {
      if (a === UNKNOWN) return 1;
      if (b === UNKNOWN) return -1;
      const sum = (k) => counts[k].reduce((x, y) => x + y, 0);
      return sum(b) - sum(a);
    });

    const matrix        = channels.map((c) => counts[c]);
    const channelTotals = matrix.map((r) => r.reduce((a, b) => a + b, 0));
    const weekTotals    = weeks.map((_, wi) => matrix.reduce((s, r) => s + r[wi], 0));

    const cumTotals = [];
    const wowPct    = [];
    weekTotals.forEach((v, i) => {
      cumTotals.push((cumTotals[i - 1] || 0) + v);
      const prev = weekTotals[i - 1];
      wowPct.push(i === 0 || prev === 0 ? null : Math.round(((v - prev) / prev) * 100));
    });

    const total          = channelTotals.reduce((a, b) => a + b, 0);
    const now            = Date.now();
    const thisWeek       = weekTotals[weekIndex(now)] || 0;
    const activeChannels = channels.filter((c) => c !== UNKNOWN).length;
    const daysToS1       = Math.max(0, Math.ceil((Date.parse(SESSIONS[0].date) - now) / DAY_MS));

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      total, thisWeek, activeChannels, daysToS1,
      filteredStats: {
        everstage:  filteredEverstage,
        noEmail:    filteredNoEmail,
        total:      filteredEverstage + filteredNoEmail,
        rawTotal:   rawSubmissions.length,
      },
      weeks, channels, matrix, channelTotals, weekTotals, cumTotals, wowPct,
      weekDailyBreakdown,
      sessions: SESSIONS,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
