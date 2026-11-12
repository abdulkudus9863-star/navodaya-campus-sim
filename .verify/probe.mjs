const { chromium } = await import(
  "/home/daytona/.bun/install/cache/playwright-core@1.52.0@@@1/index.mjs"
);
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-gpu-sandbox",
    "--disable-gpu-driver-bug-workarounds",
    "--ignore-gpu-blocklist",
  ],
});
const context = await browser.newContext({ viewport: { width: 1024, height: 700 } });
await context.addInitScript(() => {
  Element.prototype.requestPointerLock = () => undefined;
});
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(`PAGEERROR: ${error.message}`));
const start = Date.now();
await page.goto("http://localhost:5173/play", { waitUntil: "domcontentloaded", timeout: 30000 });
console.log("goto ms", Date.now() - start);
for (let i = 0; i < 12; i += 1) {
  await page.waitForTimeout(5000);
  const state = await page.evaluate(() => ({
    body: document.body.innerText.slice(0, 300),
    loading: document.body.innerText.includes("Preparing the campus") || document.body.innerText.includes("Surveying"),
    newGame: Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("New Game")),
    canvas: Boolean(document.querySelector("canvas")),
    debug: Boolean(window.__navodaya),
  }));
  console.log("t+" + Math.round((Date.now() - start) / 1000) + "s", JSON.stringify(state));
  if (state.newGame) break;
}
console.log("errors", errors);
await page.screenshot({ path: ".verify/probe.png" });
await browser.close();
