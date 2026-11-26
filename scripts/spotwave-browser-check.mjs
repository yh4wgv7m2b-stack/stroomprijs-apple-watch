import assert from "node:assert/strict";
import { chromium } from "playwright";
const url = "https://yh4wgv7m2b-stack.github.io/stroomprijs-apple-watch/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("requestfailed", r => errors.push(`${r.url()}: ${r.failure()?.errorText}`));
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => {
    const s = document.querySelector("#status")?.textContent || "";
    return s.includes("Bijgewerkt via SpotWave") || s.includes("Ophalen mislukt:");
  }, null, { timeout: 60000 });
  const status = await page.locator("#status").innerText();
  assert.ok(status.includes("Bijgewerkt via SpotWave"), `App did not report successful live update: ${status}`);
  const today = await page.evaluate(() => ({
    current: document.querySelector("#current")?.textContent,
    min: document.querySelector("#min")?.textContent,
    max: document.querySelector("#max")?.textContent,
    avg: document.querySelector("#avg")?.textContent,
    chartPoints: document.querySelector("#chart polyline")?.getAttribute("points") || "",
    cheapRows: document.querySelectorAll("#cheap .row").length,
    status: document.querySelector("#status")?.textContent
  }));
  for (const key of ["current", "min", "max", "avg"]) assert.ok(today[key] && today[key] !== "—", `${key} is empty`);
  assert.ok(today.chartPoints.length > 10, "Today's chart is not populated");
  assert.equal(today.cheapRows, 4, "Today's four cheapest quarters are not rendered");
  await page.locator('[data-day="tomorrow"]').click();
  const tomorrow = await page.evaluate(() => ({
    chartPoints: document.querySelector("#chart polyline")?.getAttribute("points") || "",
    emptyMessage: document.querySelector("#chart text")?.textContent || "",
    cheapText: document.querySelector("#cheap")?.textContent || ""
  }));
  const tomorrowPublished = !today.status.includes("morgenprijzen nog niet gepubliceerd");
  if (tomorrowPublished) {
    assert.ok(tomorrow.chartPoints.length > 10, "Tomorrow was published but its chart is empty");
    assert.equal(await page.locator("#cheap .row").count(), 4, "Tomorrow's cheapest quarters are not rendered");
  } else {
    assert.ok(tomorrow.emptyMessage.includes("Morgenprijzen nog niet gepubliceerd"), "Tomorrow empty state is unclear");
  }
  assert.deepEqual(errors, [], `Browser errors: ${errors.join("; ")}`);
  const report = { browser: "Chromium", status, today, tomorrow, tomorrowPublished, browserErrors: errors };
  console.log(JSON.stringify(report, null, 2));
  const fs = await import("node:fs/promises");
  await fs.writeFile("spotwave-verification.json", JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
