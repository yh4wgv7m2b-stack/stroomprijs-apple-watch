import assert from "node:assert/strict";

const BASE = "https://spotwave.eu/api";
const SITE = "https://yh4wgv7m2b-stack.github.io/stroomprijs-apple-watch/";
const TZ = "Europe/Amsterdam";
const headers = {
  "Accept": "application/json",
  "User-Agent": "StroomprijsLiveCheck/1.0 (+https://github.com/yh4wgv7m2b-stack/stroomprijs-apple-watch)"
};

function localDate(date, offsetDays = 0) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const o = Object.fromEntries(p.map(x => [x.type, x.value]));
  const shifted = new Date(Date.UTC(+o.year, +o.month - 1, +o.day + offsetDays));
  return shifted.toISOString().slice(0, 10);
}
function offsetMinutesAt(date) {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, timeZoneName: "shortOffset"
  }).formatToParts(date).find(x => x.type === "timeZoneName").value;
  const m = value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return m ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : 0;
}
function dayBounds(day) {
  const [y, m, d] = day.split("-").map(Number);
  const startUtc = new Date(Date.UTC(y, m - 1, d));
  const nextUtc = new Date(Date.UTC(y, m - 1, d + 1));
  const from = new Date(startUtc.getTime() - offsetMinutesAt(startUtc) * 60000);
  const toExclusive = new Date(nextUtc.getTime() - offsetMinutesAt(nextUtc) * 60000);
  return { from: from.toISOString(), to: new Date(toExclusive.getTime() - 1000).toISOString() };
}
async function getJson(url) {
  const response = await fetch(url, { headers, cache: "no-store" });
  assert.equal(response.status, 200, `${url} returned HTTP ${response.status}`);
  return { data: await response.json(), headers: response.headers };
}
function validateRows(rows, day, label, expectedRequired = true) {
  assert.ok(Array.isArray(rows), `${label} must be an array`);
  if (!rows.length) {
    assert.equal(expectedRequired, false, `${label} unexpectedly empty`);
    return { count: 0 };
  }
  const expected = dayBounds(day);
  const from = Date.parse(expected.from), to = Date.parse(expected.to);
  const starts = rows.map(x => Date.parse(x.periodUtc));
  assert.ok(starts.every(Number.isFinite), `${label}: invalid periodUtc`);
  assert.ok(rows.every(x => x.country === "NL" && Number.isFinite(Number(x.totalEurPerKwh))), `${label}: invalid country or totalEurPerKwh`);
  assert.ok(starts.every(t => t >= from && t <= to), `${label}: period outside Amsterdam local day`);
  assert.equal(new Set(starts).size, starts.length, `${label}: duplicate quarter`);
  for (let i = 1; i < starts.length; i++) {
    assert.equal(starts[i] - starts[i - 1], 15 * 60 * 1000, `${label}: gap or non-quarter interval`);
  }
  const expectedCount = (to - from + 1000) / (15 * 60 * 1000);
  assert.equal(rows.length, expectedCount, `${label}: expected ${expectedCount} quarters, got ${rows.length}`);
  return { count: rows.length, min: Math.min(...rows.map(x => x.totalEurPerKwh)), max: Math.max(...rows.map(x => x.totalEurPerKwh)) };
}

const now = new Date();
const today = localDate(now);
const tomorrow = localDate(now, 1);
const todayRange = dayBounds(today);
const tomorrowRange = dayBounds(tomorrow);
const [statusResult, todayResult, forecastResult] = await Promise.all([
  getJson(`${BASE}/meta/status`),
  getJson(`${BASE}/spotprice?country=NL&from=${encodeURIComponent(todayRange.from)}&to=${encodeURIComponent(todayRange.to)}`),
  getJson(`${BASE}/forecast?country=NL&from=${encodeURIComponent(tomorrowRange.from)}&to=${encodeURIComponent(tomorrowRange.to)}`)
]);
const publication = statusResult.data?.tomorrowPublished?.NL;
assert.equal(typeof publication, "boolean", "meta/status must expose tomorrowPublished.NL");
const todayStats = validateRows(todayResult.data, today, "today", true);
const forecastStats = validateRows(forecastResult.data, tomorrow, "forecast", publication === true);
const cors = todayResult.headers.get("access-control-allow-origin");
assert.ok(cors === "*" || cors === SITE.replace(/\/$/, "") || cors === "https://yh4wgv7m2b-stack.github.io", "SpotWave CORS header missing or incompatible");

const pageResponse = await fetch(SITE, { headers: { "User-Agent": headers["User-Agent"] }, redirect: "follow" });
assert.equal(pageResponse.status, 200, "GitHub Pages site must return HTTP 200");
const html = await pageResponse.text();
for (const marker of ["id=\"current\"", "id=\"min\"", "id=\"max\"", "id=\"avg\"", "id=\"chart\"", "spotwave.eu/api"]) {
  assert.ok(html.includes(marker), `published HTML missing ${marker}`);
}
for (const asset of ["manifest.webmanifest", "sw.js"]) {
  const r = await fetch(new URL(asset, SITE));
  assert.equal(r.status, 200, `${asset} must be hosted`);
}

const report = {
  checkedAt: now.toISOString(),
  timezone: TZ,
  today,
  todayUtcBounds: todayRange,
  tomorrow,
  tomorrowUtcBounds: tomorrowRange,
  today: todayStats,
  tomorrowPublished: publication,
  forecast: forecastStats,
  corsAllowOrigin: cors,
  pagesStatus: pageResponse.status,
  serviceWorkerAndManifest: "HTTP 200"
};
console.log(JSON.stringify(report, null, 2));
