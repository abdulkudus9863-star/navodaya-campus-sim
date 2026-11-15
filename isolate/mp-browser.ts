/**
 * Two genuinely separate browser sessions (separate contexts, separate auth,
 * separate local saves) exercise the multiplayer lobby, presence list and chat.
 *
 * Run: bun run isolate/mp-browser.ts
 */
import { chromium } from "/home/daytona/.bun/install/cache/playwright-core@1.52.0@@@1/index.mjs";

const APP = "http://localhost:5173";
const executablePath =
  "/home/daytona/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell";

const students = [
  { playerId: "qa-session-one", characterId: "ARV-001", houseId: "aravali", name: "Abdul Kudus" },
  { playerId: "qa-session-two", characterId: "NIL-001", houseId: "nilgiri", name: "Sakil" },
];

function saveFor(index: number) {
  const student = students[index];
  return {
    version: 2,
    savedAt: Date.now(),
    playtime: 120,
    player: { position: { x: 0, y: 0, z: 42 }, rotationY: 3.14 },
    settings: {
      quality: "low",
      sensitivity: 1,
      invertY: false,
      volume: 0.4,
      music: false,
      sfx: false,
    },
    character: { uniform: "navy", skin: 1 },
    mission: { started: true, step: 0, completed: [] },
    profile: {
      playerId: student.playerId,
      characterId: student.characterId,
      houseId: student.houseId,
      assignedAt: Date.now() - 86_400_000,
      xp: 0,
      level: 1,
      achievements: ["house-colours"],
    },
    night: {
      active: false,
      started: false,
      step: 0,
      collected: [],
      attempts: 0,
      caught: false,
      success: false,
      completedAt: null,
    },
    exploration: { discovered: [], planSeen: true, tourStarted: false },
    escape: {
      playerId: student.playerId,
      difficulty: "normal",
      lastLevelId: "playground-dash",
      records: [],
      achievements: [],
      checkpoint: null,
    },
  };
}

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail === undefined ? "" : ` :: ${String(detail)}`}`);
  }
}

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-gpu-sandbox",
    "--disable-gpu-driver-bug-workarounds",
    "--window-size=900,620",
  ],
});

const errors: string[] = [];

async function openSession(index: number, code?: string) {
  const context = await browser.newContext({ viewport: { width: 900, height: 620 } });
  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: "navodaya.campus.save.v1", value: JSON.stringify(saveFor(index)) },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`session ${index + 1}: ${error.message}`));
  const returnTo = code ? `/multiplayer?code=${code}` : "/multiplayer";
  await page.goto(`${APP}/auth?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: /continue as guest/i }).click();
  await page.waitForURL(/\/multiplayer/, { timeout: 30_000 });
  return { context, page };
}

try {
  console.log("\nSession 1: guest sign-in and room creation");
  const one = await openSession(0);
  await one.page.getByTestId("create-room").waitFor({ timeout: 20_000 });
  await one.page.getByTestId("create-room").click();
  await one.page.getByTestId("room-code").waitFor({ timeout: 20_000 });
  const code = (await one.page.getByTestId("room-code").innerText()).trim();
  check("host sees a six-character room code", /^[A-Z0-9]{6}$/.test(code), code);

  console.log("\nSession 2: separate guest joins with the code");
  const two = await openSession(1, code);
  await two.page.getByTestId("join-code").waitFor({ timeout: 20_000 });
  check(
    "invite link prefills the room code",
    (await two.page.getByTestId("join-code").inputValue()) === code,
    await two.page.getByTestId("join-code").inputValue(),
  );
  await two.page.getByTestId("join-room").click();
  await two.page.getByTestId("room-code").waitFor({ timeout: 20_000 });

  await one.page.waitForFunction(
    () => document.querySelectorAll('[data-testid="player-list"] > div').length >= 2,
    undefined,
    { timeout: 20_000 },
  );
  const hostList = await one.page.getByTestId("player-list").innerText();
  check("host sees both players in the room", hostList.includes("Abdul Kudus") && hostList.includes("Sakil"), hostList);
  const hostBody = await one.page.locator("body").innerText();
  check("host sees the two-player count", /2\s*\/\s*4 players/i.test(hostBody), hostBody.slice(0, 160));
  check(
    "host gets the start control",
    (await one.page.getByTestId("start-mission").count()) === 1,
  );
  check(
    "guest does not get the host start control",
    (await two.page.getByTestId("start-mission").count()) === 0,
  );
  check(
    "guest gets the ready control",
    (await two.page.getByTestId("toggle-ready").count()) === 1,
  );

  console.log("\nChat and readiness between the two sessions");
  await one.page.getByTestId("chat-input").fill("Meet at the garden gate");
  await one.page.getByTestId("chat-input").press("Enter");
  await two.page.waitForFunction(
    () => document.body.innerText.includes("Meet at the garden gate"),
    undefined,
    { timeout: 20_000 },
  );
  check("second session receives the room message", true);

  await two.page.getByTestId("toggle-ready").click();
  let hostAfterReady = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    hostAfterReady = await one.page.getByTestId("player-list").innerText();
    if (/Sakil[\s\S]*Ready/i.test(hostAfterReady) && !/Not ready/i.test(hostAfterReady)) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  check("host sees the guest ready state", /Sakil[\s\S]*Ready/i.test(hostAfterReady), hostAfterReady);

  await one.page.screenshot({ path: "isolate/lobby-host.png", fullPage: false });
  await two.page.screenshot({ path: "isolate/lobby-guest.png", fullPage: false });
  console.log("  (screenshots saved to isolate/lobby-host.png and isolate/lobby-guest.png)");

  console.log("\nLeaving the room");
  await two.page.getByRole("button", { name: /^Leave$/i }).click();
  await two.page.getByTestId("create-room").waitFor({ timeout: 20_000 });
  check("guest returns to the create/join lobby after leaving", true);
  let hostAfterLeave = "";
  for (let attempt = 0; attempt < 80; attempt += 1) {
    hostAfterLeave = await one.page.getByTestId("player-list").innerText();
    if (!hostAfterLeave.includes("Sakil")) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  check("host no longer lists the departed guest", !hostAfterLeave.includes("Sakil"), hostAfterLeave);

  await one.context.close();
  await two.context.close();
} catch (error) {
  failed += 1;
  console.log(`  FAIL  browser flow crashed :: ${error instanceof Error ? error.message : String(error)}`);
  try {
    const pages = browser.contexts().flatMap((context) => context.pages());
    for (const [index, page] of pages.entries()) {
      await page.screenshot({ path: `isolate/lobby-crash-${index}.png` });
      console.log(`  debug page ${index}: ${(await page.locator("body").innerText()).slice(0, 300)}`);
    }
  } catch {
    /* ignore debug failures */
  }
  try {
    await browser.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
}

if (errors.length > 0) console.log("\nPage errors:\n" + errors.join("\n"));
console.log(`\nResult: ${passed} passed, ${failed} failed`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
