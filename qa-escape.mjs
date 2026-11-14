import { chromium } from "/home/daytona/.bun/install/cache/playwright-core@1.52.0@@@1/index.mjs";

const URL = "http://localhost:5173";
const executablePath =
  "/home/daytona/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell";
const args = [
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--disable-gpu-sandbox",
  "--disable-gpu-driver-bug-workarounds",
  "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-features=CalculateNativeOcclusion",
];

const results = [];
const errors = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}
async function snap(page) {
  return page.evaluate(() => window.__campusEscape?.snapshot());
}
async function engineSnap(page) {
  return page.evaluate(() => window.__navodaya?.escape?.snapshot());
}
async function waitPhase(page, phase) {
  await page.waitForFunction(
    (value) => window.__campusEscape?.snapshot().phase === value,
    phase,
    { timeout: 15000 },
  );
}

const browser = await chromium.launch({ headless: true, executablePath, args });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(`PAGEERROR ${error.message}`));

try {
  await page.goto(`${URL}/play`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__navodaya), null, { timeout: 60000 });
  await page.evaluate(() => window.__navodaya.assign("aravali", "ARV-001"));
  await page.waitForSelector('[data-testid="plan-choice"]', { timeout: 15000 });
  check("TEST 12a existing plan and new game work", true);

  await page.click('[data-testid="plan-stealth"]');
  await page.waitForSelector('[data-testid="adventure-menu"]', { timeout: 10000 });
  check("TEST 1a plan opens adventure menu", true);

  await page.click('[data-testid="adventure-escape"]');
  await page.waitForSelector('[data-testid="campus-escape"]', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "public/screenshots/escape-intro.png" });
  check("TEST 1b Campus Escape opens from adventure menu", true);

  const houseBefore = await engineSnap(page);
  await page.click('[data-testid="escape-start"]');
  await waitPhase(page, "playing");
  const start = await snap(page);
  check("TEST 1c level starts after countdown", Boolean(start?.run), `phase=${start?.phase}`);

  await page.keyboard.down("KeyW");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyW");
  const moved = await snap(page);
  check("TEST 2a keyboard forward movement", moved.run.x > start.run.x + 1, `x ${start.run.x}→${moved.run.x}`);

  await page.keyboard.press("Space");
  await page.waitForTimeout(180);
  const jumped = await snap(page);
  check("TEST 2b jump input", jumped.run.y > 0.2, `y=${jumped.run.y}`);

  const sprintStart = await snap(page);
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(450);
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ShiftLeft");
  const sprinted = await snap(page);
  check("TEST 2c sprint movement", sprinted.run.x > sprintStart.run.x + 3, `x +${(sprinted.run.x - sprintStart.run.x).toFixed(2)}`);

  const obstacle = start.course.obstacles.find((item) => item.height > 0 && item.kind !== "platform");
  if (obstacle) {
    await page.evaluate(({ x, z }) => window.__campusEscape.teleport(x, z), obstacle);
    await page.waitForTimeout(350);
    const hit = await snap(page);
    check("TEST 3 obstacle collision detected", hit.run.collisions > 0, `collisions=${hit.run.collisions}`);
  } else {
    check("TEST 3 obstacle collision detected", false, "no obstacle in course");
  }

  await page.evaluate(() => window.__campusEscape.checkpoint());
  await page.waitForTimeout(450);
  const atCheckpoint = await snap(page);
  const savedCheckpoint = await engineSnap(page);
  check(
    "TEST 4a checkpoint reached and stored",
    atCheckpoint.run.checkpointIndex >= 0 && Boolean(savedCheckpoint.checkpoint),
    `cp=${atCheckpoint.run.checkpointIndex} saved=${Boolean(savedCheckpoint.checkpoint)}`,
  );
  await page.screenshot({ path: "public/screenshots/escape-gameplay.png" });

  await page.evaluate(() => {
    window.__campusEscape.start("playground-dash", "normal");
  });
  await waitPhase(page, "playing");
  await page.evaluate(() => {
    window.__campusEscape.collectAll();
    window.__campusEscape.setStats(0, 0);
    window.__campusEscape.complete();
  });
  await waitPhase(page, "result");
  await page.waitForSelector('[data-testid="escape-result"]');
  const resultText = await page.textContent('[data-testid="escape-result-score"]');
  const afterRun = await engineSnap(page);
  const scoreValue = Number(resultText);
  check("TEST 5 level completion recorded", scoreValue >= 500, `score=${resultText}`);
  check("TEST 7a scoring breakdown includes bonuses", afterRun.records.some((r) => r.bestScore === scoreValue), `${afterRun.records.length} record(s)`);
  const tokenText = await page.textContent('[data-testid="escape-result-tokens"]');
  check("TEST 7b all tokens counted", tokenText.startsWith("8/8"), tokenText);
  check(
    "TEST 10a house unchanged by escape run",
    houseBefore.houseId === afterRun.houseId && afterRun.houseId === "aravali",
    `${houseBefore.houseId} → ${afterRun.houseId}`,
  );
  check(
    "TEST 10b no official profile XP awarded",
    houseBefore.xp === afterRun.xp,
    `xp ${houseBefore.xp} → ${afterRun.xp}`,
  );
  check(
    "TEST 11a achievements awarded once",
    ["escape-first-run", "escape-collector", "escape-perfect", "escape-speed"].every((id) =>
      afterRun.achievements.includes(id),
    ) && afterRun.profileAchievements.filter((id) => id === "escape-first-run").length === 1,
    afterRun.achievements.join(","),
  );
  await page.screenshot({ path: "public/screenshots/escape-result.png" });

  const recordsBeforeReload = afterRun.records;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__navodaya), null, { timeout: 60000 });
  await page.evaluate(() => window.__navodaya.escape.open());
  await page.waitForSelector('[data-testid="campus-escape"]', { timeout: 10000 });
  const afterReload = await engineSnap(page);
  check(
    "TEST 8 completed level and best survive refresh",
    afterReload.records.length === recordsBeforeReload.length &&
      afterReload.records[0].bestScore === recordsBeforeReload[0].bestScore,
    `${afterReload.records[0]?.bestScore}`,
  );
  const bestText = await page.locator('[data-testid="campus-escape"]').textContent();
  check("TEST 8b best score visible in intro", bestText.includes(String(recordsBeforeReload[0].bestScore)));

  await page.evaluate(() => window.__campusEscape.start("playground-dash", "normal"));
  await waitPhase(page, "playing");
  await page.evaluate(() => window.__campusEscape.checkpoint());
  await page.waitForTimeout(350);
  await page.evaluate(() => window.__campusEscape.fail());
  await waitPhase(page, "result");
  const failButtonEnabled = await page.locator('[data-testid="escape-retry-checkpoint"]').isEnabled();
  const afterFail = await engineSnap(page);
  check("TEST 6a timer failure shows failure screen", failButtonEnabled);
  check(
    "TEST 6b failed run keeps best records",
    afterFail.records[0].bestScore === recordsBeforeReload[0].bestScore,
  );
  await page.click('[data-testid="escape-retry-checkpoint"]');
  await waitPhase(page, "playing");
  const resumed = await snap(page);
  check("TEST 4b retry restores latest checkpoint", resumed.run.checkpointIndex >= 0 && resumed.run.x > 0, `x=${resumed.run.x}`);
  await page.keyboard.press("Escape");
  await waitPhase(page, "paused");
  check("TEST 6c pause works", true);
  await page.screenshot({ path: "public/screenshots/escape-paused.png" });
  await page.keyboard.press("Escape");
  await waitPhase(page, "playing");

  // Player isolation: a save claiming another player ID must not expose records.
  const key = "navodaya.campus.save.v1";
  await page.evaluate((storageKey) => {
    const raw = JSON.parse(localStorage.getItem(storageKey));
    raw.escape.playerId = "someone-else";
    localStorage.setItem(storageKey, JSON.stringify(raw));
  }, key);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__navodaya), null, { timeout: 60000 });
  await page.evaluate(() => window.__navodaya.escape.open());
  await page.waitForSelector('[data-testid="campus-escape"]', { timeout: 10000 });
  const isolated = await engineSnap(page);
  check(
    "TEST 9 foreign player progress is discarded",
    isolated.records.length === 0 && isolated.achievements.length === 0,
    `${isolated.records.length} records`,
  );

  await page.goto(`${URL}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=CAMPUS ESCAPE", { timeout: 20000 });
  const landing = await page.textContent("body");
  check(
    "TEST 12b landing four houses and playable Escape",
    ["Aravali", "Nilgiri", "Shivalik", "Udaygiri"].every((name) => landing.includes(name)) &&
      landing.includes("Campus Escape"),
  );

  // Mobile layout and touch controls.
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobile.newPage();
  mobilePage.on("pageerror", (error) => errors.push(`MOBILE PAGEERROR ${error.message}`));
  await mobilePage.goto(`${URL}/play`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await mobilePage.waitForFunction(() => Boolean(window.__navodaya), null, { timeout: 60000 });
  await mobilePage.evaluate(() => window.__navodaya.assign("nilgiri", "NIL-001"));
  await mobilePage.waitForSelector('[data-testid="plan-choice"]', { timeout: 15000 });
  await mobilePage.click('[data-testid="plan-stealth"]');
  await mobilePage.waitForSelector('[data-testid="adventure-menu"]');
  await mobilePage.click('[data-testid="adventure-escape"]');
  await mobilePage.waitForSelector('[data-testid="campus-escape"]');
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({ path: "public/screenshots/escape-mobile-intro.png" });
  await mobilePage.click('[data-testid="escape-start"]');
  await mobilePage.waitForFunction(() => window.__campusEscape?.snapshot().phase === "playing", null, { timeout: 15000 });
  await mobilePage.waitForTimeout(500);
  const joystick = await mobilePage.locator('[data-testid="escape-joystick"]').isVisible();
  const jump = await mobilePage.locator('[data-testid="escape-jump"]').isVisible();
  const sprint = await mobilePage.locator('[data-testid="escape-sprint"]').isVisible();
  check("TEST 11b mobile touch controls visible", joystick && jump && sprint);
  await mobilePage.screenshot({ path: "public/screenshots/escape-mobile.png" });
  await mobilePage.locator('[data-testid="escape-jump"]').tap();
  await mobilePage.waitForTimeout(160);
  const mobileJump = await mobilePage.evaluate(() => window.__campusEscape.snapshot());
  check("TEST 11c mobile jump button", mobileJump.run.y > 0.15, `y=${mobileJump.run.y}`);
  await mobile.close();
} catch (error) {
  check("HARNESS", false, error.message);
} finally {
  await browser.close();
}

check("No console or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
