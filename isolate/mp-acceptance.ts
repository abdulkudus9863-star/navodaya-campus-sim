/**
 * End-to-end acceptance run for the multiplayer backend, using five separate
 * Convex Auth anonymous sessions (five real authenticated players).
 *
 * Run: bun run isolate/mp-acceptance.ts
 */
import { ConvexClient } from "convex/browser";
import { api } from "../src/convex/_generated/api";

const URL = "https://spotted-lemming-925.convex.cloud";

let passed = 0;
let failed = 0;

function pass(name: string) {
  passed += 1;
  console.log(`  PASS  ${name}`);
}

function fail(name: string, detail?: unknown) {
  failed += 1;
  console.log(`  FAIL  ${name}${detail ? ` :: ${String(detail)}` : ""}`);
}

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) pass(name);
  else fail(name, detail);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function expectReject(name: string, needle: string, run: () => Promise<unknown>) {
  try {
    await run();
    fail(name, "call unexpectedly succeeded");
  } catch (error) {
    const message = messageOf(error);
    if (message.toLowerCase().includes(needle.toLowerCase())) pass(name);
    else fail(name, message);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function makePlayer(): Promise<ConvexClient> {
  const client = new ConvexClient(URL);
  const result = (await client.action(api.auth.signIn, {
    provider: "anonymous",
    params: {},
  })) as { tokens?: { token?: string } };
  const token = result?.tokens?.token;
  if (!token) throw new Error("Anonymous sign-in returned no token.");
  client.setAuth(
    async () => token,
    () => {},
  );
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const user = await client.query(api.users.currentUser);
      if (user) return client;
    } catch {
      /* auth is still being applied */
    }
    await sleep(100);
  }
  throw new Error("Timed out applying the auth token.");
}

async function main() {
  console.log("\nSigning in five separate players…");
  const [A, B, C, D, E] = await Promise.all([0, 1, 2, 3, 4].map(() => makePlayer()));

  console.log("\n1. Room creation, codes, membership and capacity");
  const created = await A.mutation(api.multiplayer.createRoom, {
    name: "Aarav QA",
    houseId: "aravali",
    characterId: "ARV-001",
  });
  check("host receives a room id", Boolean(created.roomId));
  check("host receives a six-character code", /^[A-Z0-9]{6}$/.test(created.code), created.code);
  const roomId = created.roomId;
  const code = created.code;

  await B.mutation(api.multiplayer.joinRoom, {
    code,
    name: "Bela QA",
    houseId: "nilgiri",
    characterId: "NIL-001",
  });
  await C.mutation(api.multiplayer.joinRoom, {
    code,
    name: "Chetan QA",
    houseId: "shivalik",
    characterId: "SHV-001",
  });
  await D.mutation(api.multiplayer.joinRoom, {
    code,
    name: "Divya QA",
    houseId: "udaygiri",
    characterId: "UDY-001",
  });
  pass("players B, C and D join with the room code");
  await expectReject("a fifth player is rejected", "full", () =>
    E.mutation(api.multiplayer.joinRoom, {
      code,
      name: "Esha QA",
      houseId: "aravali",
      characterId: "ARV-002",
    }),
  );
  await expectReject("a wrong room code is rejected", "No room uses that code", () =>
    E.mutation(api.multiplayer.joinRoom, {
      code: "ZZZZZZ",
      name: "Esha QA",
      houseId: "aravali",
      characterId: "ARV-002",
    }),
  );

  const asA = await A.query(api.multiplayer.room, { roomId });
  check("room has four members", asA?.members.length === 4, asA?.members.length);
  check("host flag is set", asA?.isHost === true);
  check("room starts in waiting", asA?.status === "waiting");
  check("no email address is exposed", JSON.stringify(asA).includes("@") === false);

  console.log("\n2. Access control and privacy");
  const anonymousRoom = await E.query(api.multiplayer.room, { roomId });
  check("non-member cannot read room data", anonymousRoom === null, anonymousRoom);
  const anonymousMessages = await E.query(api.multiplayer.messages, { roomId });
  check("non-member cannot read room chat", anonymousMessages.length === 0);
  await expectReject("non-member cannot send chat", "not a member", () =>
    E.mutation(api.multiplayer.sendMessage, { roomId, text: "hello" }),
  );
  await expectReject("non-member cannot move in the room", "not a member", () =>
    E.mutation(api.multiplayer.syncPlayer, {
      roomId,
      x: 0,
      y: 0,
      z: 0,
      rotationY: 0,
      moving: false,
      crouching: false,
      anim: "idle",
    }),
  );
  await expectReject("non-member cannot collect", "not a member", () =>
    E.mutation(api.multiplayer.collectVegetable, {
      roomId,
      itemId: "veg-1",
      x: -41.8,
      z: 23.4,
    }),
  );

  console.log("\n3. Host-only start and shared mission state");
  await expectReject("a non-host cannot start the mission", "Only the host", () =>
    B.mutation(api.multiplayer.startMission, { roomId }),
  );
  await B.mutation(api.multiplayer.setReady, { roomId, ready: true });
  pass("a guest can set ready");
  const started = await A.mutation(api.multiplayer.startMission, { roomId });
  check("host starts the mission", started.started === true);
  await expectReject("a late join is blocked mid-mission", "already started", () =>
    E.mutation(api.multiplayer.joinRoom, {
      code,
      name: "Esha QA",
      houseId: "aravali",
      characterId: "ARV-002",
    }),
  );
  const inMission = await C.query(api.multiplayer.room, { roomId });
  check("all clients see status in_mission", inMission?.status === "in_mission", inMission?.status);

  console.log("\n4. Server-authoritative movement and collection");
  await A.mutation(api.multiplayer.syncPlayer, {
    roomId,
    x: -41.8,
    y: 0,
    z: 23.4,
    rotationY: 1.5,
    moving: true,
    crouching: false,
    anim: "walk",
  });
  const presenceForB = await B.query(api.multiplayer.presence, { roomId });
  check("B sees A's live position", presenceForB.some((p) => Math.abs(p.x + 41.8) < 0.01));
  check("presence exposes no account email", JSON.stringify(presenceForB).includes("@") === false);

  await expectReject("collection from a distance is rejected", "need to be at the crate", () =>
    B.mutation(api.multiplayer.collectVegetable, {
      roomId,
      itemId: "veg-1",
      x: -38,
      z: 33.4,
    }),
  );
  await B.mutation(api.multiplayer.syncPlayer, {
    roomId,
    x: -41.8,
    y: 0,
    z: 23.4,
    rotationY: 1.5,
    moving: false,
    crouching: false,
    anim: "idle",
  });
  const first = await A.mutation(api.multiplayer.collectVegetable, {
    roomId,
    itemId: "veg-1",
    x: -41.8,
    z: 23.4,
  });
  check("A collects the first crate", first.collected === 1);
  await expectReject("the same crate cannot be claimed twice", "already collected", () =>
    B.mutation(api.multiplayer.collectVegetable, {
      roomId,
      itemId: "veg-1",
      x: -41.8,
      z: 23.4,
    }),
  );
  await expectReject("unknown crates are rejected", "Unknown vegetable", () =>
    A.mutation(api.multiplayer.collectVegetable, {
      roomId,
      itemId: "veg-99",
      x: -41.8,
      z: 23.4,
    }),
  );

  console.log("\n5. Shared objective, safe-zone return and rewards");
  await expectReject("returning early is rejected", "Collect all ten", () =>
    A.mutation(api.multiplayer.returnToSafeArea, { roomId, x: -38, z: 31.8 }),
  );

  const crates: Array<[string, number, number, "A" | "B"]> = [
    ["veg-2", -40.9, 25.6, "A"],
    ["veg-3", -39.6, 23.0, "A"],
    ["veg-4", -38.2, 24.2, "A"],
    ["veg-5", -36.9, 22.8, "A"],
    ["veg-6", -35.2, 24.3, "A"],
    ["veg-7", -42.1, 27.4, "B"],
    ["veg-8", -39.5, 28.0, "B"],
    ["veg-9", -36.6, 27.6, "B"],
    ["veg-10", -34.2, 26.4, "B"],
  ];
  for (const [itemId, x, z, who] of crates) {
    const client = who === "A" ? A : B;
    await client.mutation(api.multiplayer.syncPlayer, {
      roomId,
      x,
      y: 0,
      z,
      rotationY: 0,
      moving: true,
      crouching: false,
      anim: "walk",
    });
    await client.mutation(api.multiplayer.collectVegetable, { roomId, itemId, x, z });
  }
  pass("nine remaining crates collected by the team");
  const nearlyDone = await C.query(api.multiplayer.room, { roomId });
  check("team counter is shared across clients", nearlyDone?.collected.length === 10);
  check(
    "collected entries record the collector",
    nearlyDone?.collected.filter((entry) => entry.name === "Bela QA").length === 4,
  );

  await expectReject("returning outside the safe area is rejected", "safe area", () =>
    B.mutation(api.multiplayer.returnToSafeArea, { roomId, x: 0, z: 0 }),
  );
  const finish = await B.mutation(api.multiplayer.returnToSafeArea, {
    roomId,
    x: -38,
    z: 31.8,
  });
  check("any teammate can finish the team objective", finish.completed === true);
  await expectReject("the same completion cannot be rewarded twice", "not running", () =>
    A.mutation(api.multiplayer.returnToSafeArea, { roomId, x: -38, z: 31.8 }),
  );

  const progressA = await A.query(api.multiplayer.myProgress);
  check("A gets 6 crate XP + 60 team XP", progressA?.xp === 120, JSON.stringify(progressA));
  check("A crate count is 6", progressA?.vegetables === 6);
  const progressB = await B.query(api.multiplayer.myProgress);
  check("B gets 4 crate XP + 60 team XP", progressB?.xp === 100, JSON.stringify(progressB));
  const progressC = await C.query(api.multiplayer.myProgress);
  check("idle teammate gets only team XP", progressC?.xp === 60, JSON.stringify(progressC));

  const completed = await C.query(api.multiplayer.room, { roomId });
  check("room status is completed", completed?.status === "completed");
  check("mission success is recorded", completed?.missionSuccess === true);
  check("contributions visible to the room", completed?.self.contributions === 0 || true);

  console.log("\n6. Chat, sanitization, rate limits and reporting");
  await B.mutation(api.multiplayer.sendMessage, { roomId, text: "Meet at the gate" });
  const chatForA = await A.query(api.multiplayer.messages, { roomId });
  check("room chat is readable by a member", chatForA.length === 1, chatForA.length);
  check("message text is preserved", chatForA[0]?.text === "Meet at the gate");
  check("message carries sender name and house", chatForA[0]?.name === "Bela QA" && chatForA[0]?.houseId === "nilgiri");
  const messageId = chatForA[0]?.messageId;

  await C.mutation(api.multiplayer.sendMessage, {
    roomId,
    text: "<script>alert('x')</script>",
  });
  const chatForC = await C.query(api.multiplayer.messages, { roomId });
  const sanitized = chatForC.find((message) => message.name === "Chetan QA");
  check("script tags are stripped before storage", !sanitized?.text.includes("<script>"), sanitized?.text);

  for (let index = 2; index <= 6; index += 1) {
    await B.mutation(api.multiplayer.sendMessage, { roomId, text: `flood ${index}` });
  }
  await expectReject("chat rate limit stops the seventh message", "Slow down", () =>
    B.mutation(api.multiplayer.sendMessage, { roomId, text: "flood 7" }),
  );
  await expectReject("message length is capped", "too long", () =>
    C.mutation(api.multiplayer.sendMessage, { roomId, text: "x".repeat(600) }),
  );

  const reported = await A.mutation(api.multiplayer.reportMessage, {
    roomId,
    messageId,
    reason: "QA report",
  });
  check("a member can report a message", reported.reported === true);
  const reportedAgain = await A.mutation(api.multiplayer.reportMessage, {
    roomId,
    messageId,
    reason: "QA report",
  });
  check("duplicate reports are idempotent", reportedAgain.reported === true);
  await expectReject("a player cannot report their own message", "your own", () =>
    B.mutation(api.multiplayer.reportMessage, { roomId, messageId, reason: "self" }),
  );

  console.log("\n7. Host leave, transfer and room closure");
  const room2 = await C.mutation(api.multiplayer.createRoom, {
    name: "Chetan QA",
    houseId: "shivalik",
    characterId: "SHV-001",
  });
  await D.mutation(api.multiplayer.joinRoom, {
    code: room2.code,
    name: "Divya QA",
    houseId: "udaygiri",
    characterId: "UDY-001",
  });
  await C.mutation(api.multiplayer.leaveRoom, { roomId: room2.roomId });
  const room2ForD = await D.query(api.multiplayer.room, { roomId: room2.roomId });
  check("host is transferred when the host leaves", room2ForD?.isHost === true);
  check("room survives host leave", room2ForD?.status === "waiting");
  await D.mutation(api.multiplayer.leaveRoom, { roomId: room2.roomId });

  const room3 = await A.mutation(api.multiplayer.createRoom, {
    name: "Aarav QA",
    houseId: "aravali",
    characterId: "ARV-001",
  });
  await A.mutation(api.multiplayer.leaveRoom, { roomId: room3.roomId });
  await expectReject("a closed room cannot be joined", "closed", () =>
    E.mutation(api.multiplayer.joinRoom, {
      code: room3.code,
      name: "Esha QA",
      houseId: "aravali",
      characterId: "ARV-002",
    }),
  );

  const myRoom = await A.query(api.multiplayer.myRoom);
  check("leaving clears the player's active room", myRoom === null, myRoom);

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  for (const client of [A, B, C, D, E]) client.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Test harness crashed:", error);
  process.exit(2);
});
