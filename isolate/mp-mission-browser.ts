/**
 * Two-browser-session check of the shared 3D mission: both authenticated
 * sessions enter the same room, each renders the other's character, movement
 * and crouch propagate, and a crate collected by one disappears for both.
 *
 * Run: bun run isolate/mp-mission-browser.ts
 */
import { chromium } from "/home/daytona/.bun/install/cache/playwright-core@1.52.0@@@1/index.mjs";

const APP = "http://localhost:5173";
const executablePath =
  "/home/daytona/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell";

const profiles = [
  { playerId: "qa-mission-one", characterId: "ARV-001", houseId: "aravali", name: "Abdul Kudus" },
  { playerId: "qa-mission-two", characterId: "NIL-001", houseId: "nilgiri", name: "Sakil" },
];

function saveFor(index: number) {
  const profile = profiles[index];
  return {
    version: 2,
    savedAt: Date.now(),
    playtime: 60,
    player: { position: { x: 0, y: 0, z: 42 }, rotationY: 3.14 },
    settings: { quality: "low", sensitivity: 1, invertY: false, volume: 0, music: false, sfx: false },
    character: { uniform: "navy", skin: 1 },
    mission: { started: true, step: 0, completed: [] },
    profile: {
      playerId: profile.playerId,
      characterId: profile.characterId,
      houseId: profile.houseId,
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
      playerId: profile.playerId,
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
    console.log(`  FAIL  ${name}${detail === undefined ? "" : ` :: ${JSON.stringify(detail).slice(0, 300)}`}`);
  }
}

type Snapshot = {
  screen: string;
  position: { x: number; z: number };
  multiplayer: null | {
    collected: number;
    frozen: boolean;
    remotes: Array<{ x: number; z: number; crouching: boolean; anim: string; visible: boolean }>;
  };
};

async function snapshot(page: import("/home/daytona/.bun/install/cache/playwright-core@1.52.0@@@1/index.d.ts").Page): Promise<Snapshot | null> {
  return await page.evaluate(() => {
    const api = (window as unknown as { __navodaya?: { snapshot: () => unknown } }).__navodaya;
    return api ? (api.snapshot() as Snapshot) : null;
  });
}

async function waitFor(
  page: import("/home/daytona/.bun/install/cache/playwright-core@1.52.0@@@1/index.d.ts").Page,
  label: string,
  predicate: (snap: Snapshot | null) => boolean,
  timeoutMs = 60_000,
): Promise<Snapshot | null> {
  const start = Date.now();
  let last: Snapshot | null = null;
  while (Date.now() - start < timeoutMs) {
    last = await snapshot(page);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  console.log(`  (timed out waiting for ${label}; last snapshot ${JSON.stringify(last).slice(0, 300)})`);
  return last;
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
    "--js-flags=--max-old-space-size=512",
  ],
});

const errors: string[] = [];

async function openSession(index: number) {
  const context = await browser.newContext({ viewport: { width: 720, height: 460 } });
  await context.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: "navodaya.campus.save.v1", value: JSON.stringify(saveFor(index)) },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`session ${index + 1}: ${error.message}`));
  await page.goto(`${APP}/auth?returnTo=/multiplayer`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /continue as guest/i }).click();
  await page.waitForURL(/\/multiplayer/, { timeout: 30_000 });
  return { context, page };
}

try {
  const host = await openSession(0);
  await host.page.getByTestId("create-room").waitFor({ timeout: 20_000 });
  await host.page.getByTestId("create-room").click();
  await host.page.getByTestId("room-code").waitFor({ timeout: 20_000 });
  const code = (await host.page.getByTestId("room-code").innerText()).trim();

  const guest = await openSession(1);
  await guest.page.getByTestId("join-code").fill(code);
  await guest.page.getByTestId("join-room").click();
  await guest.page.getByTestId("room-code").waitFor({ timeout: 20_000 });
  await host.page.getByTestId("start-mission").waitFor({ timeout: 20_000 });

  console.log("\nStarting the shared 3D mission (software WebGL)");
  await host.page.getByTestId("start-mission").click();

  const hostPlaying = await waitFor(host.page, "host mission", (snap) => snap?.multiplayer !== null, 90_000);
  check("host engine enters the multiplayer mission", hostPlaying?.multiplayer !== null, hostPlaying?.screen);
  const guestPlaying = await waitFor(guest.page, "guest mission", (snap) => snap?.multiplayer !== null, 90_000);
  check("guest engine enters the same mission", guestPlaying?.multiplayer !== null, guestPlaying?.screen);

  if (!hostPlaying?.multiplayer || !guestPlaying?.multiplayer) {
    throw new Error("Both engines did not enter the mission (WebGL likely unavailable).");
  }

  const hostSeesGuest = await waitFor(
    host.page,
    "host remote character",
    (snap) => (snap?.multiplayer?.remotes.length ?? 0) > 0,
    30_000,
  );
  const guestSeesHost = await waitFor(
    guest.page,
    "guest remote character",
    (snap) => (snap?.multiplayer?.remotes.length ?? 0) > 0,
    30_000,
  );
  check("host renders the guest character", (hostSeesGuest?.multiplayer?.remotes.length ?? 0) > 0);
  check("guest renders the host character", (guestSeesHost?.multiplayer?.remotes.length ?? 0) > 0);
  check(
    "remote characters are visible in the scene",
    Boolean(hostSeesGuest?.multiplayer?.remotes[0]?.visible),
  );

  console.log("\nWalking, crouching and shared collection");
  await guest.page.keyboard.down("w");
  await new Promise((resolve) => setTimeout(resolve, 1400));
  await guest.page.keyboard.up("w");

  const moved = await waitFor(
    host.page,
    "host sees movement",
    (snap) => {
      const remote = snap?.multiplayer?.remotes[0];
      return Boolean(
        remote && (Math.abs(remote.x - guestPlaying.multiplayer!.remotes[0]?.x || 0) > 0.25 ||
          Math.abs(remote.z + 33.4) > 0.25),
      );
    },
    15_000,
  );
  const remoteAfterWalk = moved?.multiplayer?.remotes[0];
  check(
    "host sees the guest move",
    Boolean(remoteAfterWalk && (Math.abs(remoteAfterWalk.z + 33.4) > 0.25 || remoteAfterWalk.anim !== "idle")),
    remoteAfterWalk,
  );

  await guest.page.keyboard.press("c");
  const crouched = await waitFor(
    host.page,
    "host sees crouch",
    (snap) => Boolean(snap?.multiplayer?.remotes[0]?.crouching),
    10_000,
  );
  check("crouch state synchronises", Boolean(crouched?.multiplayer?.remotes[0]?.crouching));

  await host.page.evaluate(() => {
    const api = (window as unknown as { __navodaya?: { teleport: (x: number, z: number) => void } })
      .__navodaya;
    api?.teleport(-40.9, 25.6);
  });
  await new Promise((resolve) => setTimeout(resolve, 800));
  await host.page.keyboard.press("e");

  const hostCollected = await waitFor(
    host.page,
    "host shared counter",
    (snap) => (snap?.multiplayer?.collected ?? 0) >= 1,
    20_000,
  );
  const guestCollected = await waitFor(
    guest.page,
    "guest shared counter",
    (snap) => (snap?.multiplayer?.collected ?? 0) >= 1,
    20_000,
  );
  check("collecting a crate updates the host", (hostCollected?.multiplayer?.collected ?? 0) >= 1);
  check(
    "the same crate is removed for the guest",
    guestCollected?.multiplayer?.collected === hostCollected?.multiplayer?.collected,
    { host: hostCollected?.multiplayer?.collected, guest: guestCollected?.multiplayer?.collected },
  );

  await host.page.screenshot({ path: "isolate/mission-host.png" });
  await guest.page.screenshot({ path: "isolate/mission-guest.png" });

  await host.context.close();
  await guest.context.close();
} catch (error) {
  failed += 1;
  console.log(`  FAIL  mission browser flow crashed :: ${error instanceof Error ? error.message : String(error)}`);
  try {
    const pages = browser.contexts().flatMap((context) => context.pages());
    for (const [index, page] of pages.entries()) {
      await page.screenshot({ path: `isolate/mission-crash-${index}.png` });
      console.log(`  debug page ${index}: ${(await page.locator("body").innerText()).slice(0, 240)}`);
    }
  } catch {
    /* ignore debug failures */
  }
}

if (errors.length > 0) console.log("\nPage errors:\n" + errors.slice(0, 6).join("\n"));
console.log(`\nResult: ${passed} passed, ${failed} failed`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
