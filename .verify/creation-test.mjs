const { chromium } = await import(
  "/home/daytona/.bun/install/cache/playwright-core@1.52.0@@@1/index.mjs"
);
const errors = [];
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
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(() => {
  Element.prototype.requestPointerLock = () => undefined;
});
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(`PAGEERROR: ${error.message}`));

const expectedFirst = {
  aravali: "ARV-001",
  nilgiri: "NIL-001",
  shivalik: "SHV-001",
  udaygiri: "UDY-001",
};
const expectedPrefix = {
  aravali: "ARV-",
  nilgiri: "NIL-",
  shivalik: "SHV-",
  udaygiri: "UDY-",
};
const expectedCount = { aravali: 9, nilgiri: 7, shivalik: 4, udaygiri: 4 };

try {
  await page.goto("http://localhost:5173/play", { waitUntil: "domcontentloaded", timeout: 60000 });
  const newGame = page.getByRole("button", { name: /New Game/ }).first();
  await newGame.waitFor({ timeout: 90000 });
  await page.getByRole("button", { name: /Settings/ }).first().click();
  await page.getByRole("button", { name: /^low$/i }).click();
  await page.getByRole("button", { name: /^Done$/ }).click();
  await page.waitForTimeout(250);
  await newGame.click();
  await page.getByTestId("creation-stage").waitFor({ timeout: 15000 });
  console.log("Creation stage:", await page.getByTestId("creation-stage").innerText());
  console.log("House cards:", await page.locator('[data-testid^="house-card-"]').count());
  console.log("Aravali preselected:", await page.getByTestId("house-card-aravali").getAttribute("aria-pressed"));
  console.log("Roster:", JSON.stringify(await page.evaluate(() => window.__navodaya.roster())));

  for (const house of ["aravali", "nilgiri", "shivalik", "udaygiri"]) {
    await page.getByTestId(`house-card-${house}`).click();
    const pressed = await page.getByTestId(`house-card-${house}`).getAttribute("aria-pressed");
    const cta = (await page.getByRole("button", { name: /Continue with/ }).innerText()).replace(/\s+/g, " ").trim();
    await page.getByRole("button", { name: /Continue with/ }).click();
    await page.getByTestId("confirm-house").waitFor({ timeout: 10000 });
    await page.getByTestId("confirm-house").click();
    await page.getByTestId(`student-card-${expectedFirst[house]}`).waitFor({ timeout: 10000 });
    const ids = await page.locator('[data-testid^="student-card-"]').evaluateAll((cards) =>
      cards.map((card) => card.getAttribute("data-testid")?.replace("student-card-", "") ?? ""),
    );
    const names = await page.locator('[data-testid^="student-card-"]').allInnerTexts();
    const filtered = ids.every((id) => id.startsWith(expectedPrefix[house]));
    console.log("Gallery", house, { pressed, cta, count: ids.length, expected: expectedCount[house], filtered, ids });
    console.log("Gallery names", house, names.map((text) => text.replace(/\s+/g, " ").trim()).join(" | "));
    await page.getByRole("button", { name: /House confirmation/ }).click();
    await page.getByTestId("confirm-house").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: /Change house/ }).click();
    await page.getByTestId("house-card-aravali").waitFor({ timeout: 10000 });
  }

  await page.getByTestId("house-card-nilgiri").click();
  await page.getByRole("button", { name: /Continue with Nilgiri/ }).click();
  await page.getByTestId("confirm-house").click();
  await page.getByTestId("student-card-NIL-005").waitFor({ timeout: 10000 });
  const nilgiriCards = await page.locator('[data-testid^="student-card-"]').allInnerTexts();
  console.log("Nilgiri Suraj separate:", {
    card: await page.getByTestId("student-card-NIL-005").count(),
    aravaliSurajAbsent: (await page.getByTestId("student-card-ARV-002").count()) === 0,
    noAravaliNames: !nilgiriCards.some((text) => /Abdul Kudus|Paikhomba|Yeningthoiba/.test(text)),
  });
  await page.getByTestId("student-card-NIL-005").click();
  await page.getByTestId("confirm-character").click();
  await page.getByTestId("enter-campus").waitFor({ timeout: 10000 });
  await page.getByTestId("enter-campus").click();
  await page.getByTestId("hud-profile").waitFor({ timeout: 20000 });
  const snapshot = await page.evaluate(() => window.__navodaya.snapshot());
  console.log("Entered:", {
    screen: snapshot.screen,
    houseId: snapshot.houseId,
    characterId: snapshot.characterId,
    xp: snapshot.xp,
  });
  console.log("HUD:", (await page.getByTestId("hud-profile").innerText()).replace(/\s+/g, " ").trim());
  await page.getByTestId("hud-profile").click();
  await page.getByTestId("profile-panel").waitFor({ timeout: 10000 });
  const profileText = await page.getByTestId("profile-panel").evaluate((element) => element.textContent ?? "");
  console.log("Profile checks:", {
    name: profileText.includes("Suraj"),
    id: profileText.includes("NIL-005"),
    house: profileText.includes("Nilgiri House"),
    hostel: profileText.includes("Nilgiri Nilayam"),
    class: profileText.includes("Class VII"),
    captain: profileText.includes("Deccan"),
    prefect: profileText.includes("Ronil"),
    standings: profileText.includes("House Cup"),
    achievements: profileText.includes("Achievements"),
    playerId: profileText.includes("Player ID"),
    term1: profileText.includes("Term I standings"),
  });
  console.log("Profile text length:", profileText.length);
  await page.getByRole("button", { name: "Close profile" }).click();
  console.log("Profile closed:", await page.evaluate(() => window.__navodaya.snapshot().profileOpen));
} catch (error) {
  console.error("TEST FAILURE:", error.message);
  process.exitCode = 1;
}
console.log("Console errors:", errors.length);
errors.slice(0, 20).forEach((error) => console.log("  ERR", error));
await browser.close();
