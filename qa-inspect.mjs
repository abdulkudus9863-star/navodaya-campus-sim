import { chromium } from "/home/daytona/.bun/install/cache/playwright-core@1.52.0@@@1/index.mjs";
import { appendFileSync, writeFileSync } from "node:fs";
const log = (message) => appendFileSync("/tmp/qa-plan.txt", `${new Date().toISOString()} ${message}\n`);
writeFileSync("/tmp/qa-plan.txt", "");
const executablePath = "/home/daytona/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell";
const browser = await chromium.launch({ headless: true, executablePath, args: [
  "--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--disable-gpu-sandbox", "--disable-gpu-driver-bug-workarounds", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeOcclusion",
] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on("pageerror", (e) => log(`PAGEERROR ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") log(`CONSOLE ${m.text().slice(0, 240)}`); });
log("goto");
await page.goto("http://localhost:5173/play", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(15000);
log(`api ${await page.evaluate(() => Boolean(window.__navodaya))}`);
log(`body-loading ${(await page.textContent("body")).slice(0, 240)}`);
if (!(await page.evaluate(() => Boolean(window.__navodaya)))) {
  const client0 = await page.context().newCDPSession(page);
  const shot0 = await client0.send("Page.captureScreenshot", { format: "jpeg", quality: 70, fromSurface: true });
  writeFileSync("public/screenshots/escape-load.jpg", Buffer.from(shot0.data, "base64"));
  process.exit(0);
}
log("api");
log(`assign ${JSON.stringify(await page.evaluate(() => window.__navodaya.assign("aravali", "ARV-001")))}`);
await page.waitForTimeout(1500);
log(`snapshot ${JSON.stringify(await page.evaluate(() => window.__navodaya.snapshot()))}`);
log(`planVisible ${await page.locator('[data-testid="plan-choice"]').isVisible().catch((e) => e.message)}`);
log(`body ${(await page.textContent("body")).slice(0, 220)}`);
const client = await page.context().newCDPSession(page);
const shot = await client.send("Page.captureScreenshot", { format: "jpeg", quality: 75, fromSurface: true });
writeFileSync("public/screenshots/escape-plan.jpg", Buffer.from(shot.data, "base64"));
log("shot");
process.exit(0);
