// pages/api/registrations.js
// Sales Comp Week '26 — Registration Tracker
//
// Channel distribution comes ENTIRELY from HubSpot Form Submissions.
// For each submission we read the conversion `pageUrl` and parse
// utm_source / utm_medium / utm_campaign from its query string.
//
// The old 3 endpoints (companies/search, properties/companies/lifecyclestage,
// owners/{id}) are NOT used — they belonged to a company-prospecting script and
// are not needed for channel tracking.
//
// Required HubSpot Private App scope: `forms`
// Token is read from the HUBSPOT_TOKEN env var (set in Vercel — never in code).

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const FORM_NAME = "[Webinar Registration] Sales Comp Week 2026: June - July";

// ---- Summit timeline ----------------------------------------------------
const WEEK1_START = Date.UTC(2026, 4, 14); // May 14, 2026 (form created)
const TOTAL_WEEKS = 9; // W1 May 14 ... W9 Jul 9 (final session week)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const SESSIONS = [
  { id: "S1", title: "The Mid-Year Comp Reset", date: "2026-06-23" },
  { id: "S2", title: "The Comp Infrastructure Gap", date: "2026-07-07" },
  { id: "S3", title: "The Comp Efficiency Paradox", date: "2026-07-09" },
];

const UNKNOWN = "Direct / Unknown";

// ---- HubSpot helper -----------------------------------------------------
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

// 1. Find the form by name -> formId
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

// 2. Pull every submission (paginated; limit max = 50)
async function getSubmissions(formId) {
  const out = [];
  let after;
  do {
    const qs = after ? `?limit=50&after=${after}` : `?limit=50`;
    const data = await hs(
      `/form-integrations/v1/submissions/forms/${formId}${qs}`
    );
    out.push(...(data.results || []));
    after = data.paging?.next?.after;
  } while (after);
  return out;
}

// ---- UTM parsing --------------------------------------------------------
// Read utm_* from the conversion pageUrl. Returns null if no UTMs present.
function parseUtms(pageUrl) {
  if (!pageUrl) return null;
  try {
    const params = new URL(pageUrl).searchParams;
    const source = params.get("utm_source");
    const medium = params.get("utm_medium");
    const campaign = params.get("utm_campaign");
    if (!source && !medium && !campaign) return null;
    return {
      source: source || "(none)",
      medium: medium || "(none)",
      campaign: campaign || "(none)",
    };
  } catch {
    return null; // malformed URL
  }
}

// Channel shown as-is: "campaign | medium | source" (no hardcoded mapping).
function channelKey(utm) {
  return utm ? `${utm.campaign} | ${utm.medium} | ${utm.source}` : UNKNOWN;
}

function weekIndex(tsMs) {
  const i = Math.floor((tsMs - WEEK1_START) / WEEK_MS);
  return Math.min(Math.max(i, 0), TOTAL_WEEKS - 1);
}

// ---- Handler ------------------------------------------------------------
export default async function handler(req, res) {
  try {
    // Never let Vercel/CDN serve a cached copy — always read live from HubSpot.
    res.setHeader("Cache-Control", "no-store, max-age=0");

    if (!HUBSPOT_TOKEN) throw new Error("HUBSPOT_TOKEN env var not set");

    const formId = await getFormId();
    const submissions = await getSubmissions(formId);

    // Week headers with session milestone markers
    const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
      const start = WEEK1_START + i * WEEK_MS;
      const startD = new Date(start);
      const sessions = SESSIONS.filter((s) => {
        const sd = Date.parse(s.date);
        return sd >= start && sd < start + WEEK_MS;
      }).map((s) => s.id);
      return {
        label: `W${i + 1} ${startD.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })}`,
        startISO: startD.toISOString().slice(0, 10),
        sessions,
      };
    });

    // Aggregate: channel -> [count per week]
    const counts = {};
    for (const sub of submissions) {
      const key = channelKey(parseUtms(sub.pageUrl));
      const wi = weekIndex(sub.submittedAt);
      (counts[key] ||= new Array(TOTAL_WEEKS).fill(0))[wi] += 1;
    }

    // Sort channels by total desc, keep Direct/Unknown last
    const channels = Object.keys(counts).sort((a, b) => {
      if (a === UNKNOWN) return 1;
      if (b === UNKNOWN) return -1;
      const sum = (k) => counts[k].reduce((x, y) => x + y, 0);
      return sum(b) - sum(a);
    });

    const matrix = channels.map((c) => counts[c]);
    const channelTotals = matrix.map((r) => r.reduce((a, b) => a + b, 0));
    const weekTotals = weeks.map((_, wi) =>
      matrix.reduce((s, r) => s + r[wi], 0)
    );

    // Cumulative + WoW % change
    const cumTotals = [];
    const wowPct = [];
    weekTotals.forEach((v, i) => {
      cumTotals.push((cumTotals[i - 1] || 0) + v);
      const prev = weekTotals[i - 1];
      wowPct.push(
        i === 0 || prev === 0 ? null : Math.round(((v - prev) / prev) * 100)
      );
    });

    const total = channelTotals.reduce((a, b) => a + b, 0);

    // Stat cards
    const now = Date.now();
    const thisWeek = weekTotals[weekIndex(now)] || 0;
    const activeChannels = channels.filter((c) => c !== UNKNOWN).length;
    const daysToS1 = Math.max(
      0,
      Math.ceil((Date.parse(SESSIONS[0].date) - now) / DAY_MS)
    );

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      total,
      thisWeek,
      activeChannels,
      daysToS1,
      weeks,
      channels,
      matrix,
      channelTotals,
      weekTotals,
      cumTotals,
      wowPct,
      sessions: SESSIONS,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
