const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "/home/daytona/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-gpu-sandbox",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(5000);
  console.log("TITLE", await page.title());
  console.log("URL", page.url());
  console.log("BODY", (await page.locator("body").innerText()).slice(0, 1400));
  console.log("CANVAS", await page.locator("canvas").count());
  console.log("ERRORS", errors.slice(0, 10));
  await page.screenshot({ path: "browser-mobile.png", fullPage: false });
  await browser.close();
})().catch((error) => {
  console.error("BROWSER_FAILED", error.message);
  process.exit(1);
});
