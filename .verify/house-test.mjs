const { chromium } = await import(
  "/home/daytona/.bun/install/cache/playwright-core@1.52.0@@@1/index.mjs"
);

const errors = [];
const warnings = [];
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
  if (message.type() === "warning") warnings.push(message.text());
});
page.on("pageerror", (error) => errors.push(`PAGEERROR: ${error.message}`));

const snapshot = () => page.evaluate(() => window.__navodaya.snapshot());
const roster = () => page.evaluate(() => window.__navodaya.roster());

try {
  await page.goto("http://localhost:5173/play", { waitUntil: "domcontentloaded", timeout: 60000 });
  const newGame = page.getByRole("button", { name: /New Game/ }).first();
  await newGame.waitFor({ timeout: 90000 });

  await page.getByRole("button", { name: /Settings/ }).first().click();
  await page.getByRole("button", { name: /^low$/i }).click();
  await page.getByRole("button", { name: /^Done$/ }).click();
  await page.waitForTimeout(300);

  await newGame.click();
  await page.getByTestId("creation-stage").waitFor({ timeout: 15000 });
  console.log("Creation opened:", await page.getByTestId("creation-stage").innerText());

  const houseCards = page.locator('[data-testid^="house-card-"]');
  console.log("House cards:", await houseCards.count());
  const aravali = page.getByTestId("house-card-aravali");
  console.log("Aravali preselected:", await aravali.getAttribute("aria-pressed"));
  for (const house of ["aravali", "nilgiri", "shivalik", "udaygiri"]) {
    console.log("House present", house, await page.getByTestId(`house-card-${house}`).isVisible());
  }

  const rosterInfo = await roster();
  console.log("Roster:", JSON.stringify(rosterInfo, null, 0));

  // Check every house can be selected and the CTA updates.
  for (const house of ["nilgiri", "shivalik", "udaygiri", "aravali"]) {
    await page.getByTestId(`house-card-${house}`).click();
    const pressed = await page.getByTestId(`house-card-${house}`).getAttribute("aria-pressed");
    const cta = await page.getByRole("button", { name: /Continue with/ }).innerText();
    console.log("Selected", house, { pressed, cta: cta.trim() });
  }

  await page.getByTestId("house-card-nilgiri").click();
  await page.getByRole("button", { name: /Continue with Nilgiri/ }).click();
  await page.getByTestId("confirm-house").waitFor({ timeout: 10000 });
  const confirmText = await page.locator("body").innerText();
  console.log("House confirmation visible:", confirmText.includes("Confirm your house"));

  await page.getByTestId("confirm-house").click();
  await page.getByTestId("student-card-NIL-001").waitFor({ timeout: 10000 });
  const nilgiriCards = await page.locator('[data-testid^="student-card-"]').allInnerTexts();
  console.log("Nilgiri gallery count:", nilgiriCards.length);
  console.log("Nilgiri gallery:", nilgiriCards.map((text) => text.replace(/\s+/g, " ").trim()).join(" | "));
  console.log("No Aravali name in Nilgiri gallery:", !nilgiriCards.some((text) => /Abdul Kudus|Paikhomba|Yeningthoiba/.test(text)));
  console.log("Nilgiri Suraj card exists:", await page.getByTestId("student-card-NIL-005").count());
  console.log("Aravali Suraj absent from Nilgiri gallery:", (await page.getByTestId("student-card-ARV-002").count()) === 0);

  await page.getByTestId("student-card-NIL-005").click();
  await page.getByTestId("confirm-character").waitFor({ timeout: 10000 });
  const preview = await page.locator("body").innerText();
  console.log("Preview has name/id/house:", {
    suraj: preview.includes("Suraj"),
    id: preview.includes("NIL-005"),
    house: preview.includes("Nilgiri House"),
    class: preview.includes("Class VII"),
  });
  await page.getByTestId("confirm-character").click();
  await page.getByTestId("enter-campus").waitFor({ timeout: 10000 });
  const finalText = await page.locator("body").innerText();
  console.log("Final confirmation has house/student:", {
    suraj: finalText.includes("Suraj"),
    nilgiri: finalText.includes("Nilgiri House"),
    hostel: finalText.includes("Nilgiri Nilayam"),
  });
  await page.getByTestId("enter-campus").click();
  await page.getByTestId("hud-profile").waitFor({ timeout: 20000 });
  console.log("Entered game snapshot:", await snapshot());
  const hudText = await page.getByTestId("hud-profile").innerText();
  console.log("HUD profile text:", hudText.replace(/\s+/g, " ").trim());

  await page.getByTestId("hud-profile").click();
  await page.getByTestId("profile-panel").waitFor({ timeout: 10000 });
  const profileText = await page.getByTestId("profile-panel").innerText();
  console.log("Profile identity:", {
    name: profileText.includes("Suraj"),
    id: profileText.includes("NIL-005"),
    house: profileText.includes("Nilgiri House"),
    hostel: profileText.includes("Nilgiri Nilayam"),
    class: profileText.includes("Class VII"),
    captain: profileText.includes("Deccan"),
    standings: profileText.includes("House Cup"),
    achievements: profileText.includes("Achievements"),
    playerId: profileText.includes("Player ID"),
  });
  await page.getByRole("button", { name: "Close profile" }).click();
  await page.waitForTimeout(300);

  // Save and reload.
  await page.getByRole("button", { name: /Pause game/ }).click();
  await page.getByRole("button", { name: /Save progress/ }).click();
  await page.waitForTimeout(400);
  const rawSave = await page.evaluate(() => localStorage.getItem("navodaya.campus.save.v1"));
  console.log("Save written:", Boolean(rawSave), "version:", JSON.parse(rawSave).version, "house:", JSON.parse(rawSave).profile.houseId, "character:", JSON.parse(rawSave).profile.characterId);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Continue/ }).first().waitFor({ timeout: 90000 });
  await page.getByRole("button", { name: /Continue/ }).first().click();
  await page.getByTestId("hud-profile").waitFor({ timeout: 20000 });
  const restored = await snapshot();
  console.log("Restored snapshot:", { houseId: restored.houseId, characterId: restored.characterId, screen: restored.screen });
  await page.getByTestId("hud-profile").click();
  await page.getByTestId("profile-panel").waitFor({ timeout: 10000 });
  const restoredProfile = await page.getByTestId("profile-panel").innerText();
  console.log("Restored profile house/character:", {
    house: restoredProfile.includes("Nilgiri House"),
    character: restoredProfile.includes("NIL-005"),
  });
  await page.getByRole("button", { name: "Close profile" }).click();

  // Invalid house and student/house mismatch must be rejected on load.
  const invalidContext = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const invalidPage = await invalidContext.newPage();
  await invalidPage.goto("http://localhost:5173/play", { waitUntil: "domcontentloaded", timeout: 60000 });
  await invalidPage.getByRole("button", { name: /New Game/ }).first().waitFor({ timeout: 90000 });
  const tampered = JSON.parse(rawSave);
  tampered.profile.houseId = "hufflepuff";
  await invalidPage.evaluate((payload) => {
    localStorage.setItem("navodaya.campus.save.v1", JSON.stringify(payload));
  }, tampered);
  await invalidPage.reload({ waitUntil: "domcontentloaded" });
  await invalidPage.getByRole("button", { name: /New Game/ }).first().waitFor({ timeout: 90000 });
  const invalidHouse = {
    continueButtons: await invalidPage.getByRole("button", { name: /Continue/ }).count(),
    storageCleared: await invalidPage.evaluate(() => localStorage.getItem("navodaya.campus.save.v1") === null),
  };
  console.log("Invalid house rejected:", invalidHouse);

  const mismatch = JSON.parse(rawSave);
  mismatch.profile.characterId = "ARV-001";
  mismatch.profile.houseId = "nilgiri";
  await invalidPage.evaluate((payload) => {
    localStorage.setItem("navodaya.campus.save.v1", JSON.stringify(payload));
  }, mismatch);
  await invalidPage.reload({ waitUntil: "domcontentloaded" });
  await invalidPage.getByRole("button", { name: /New Game/ }).first().waitFor({ timeout: 90000 });
  const mismatchResult = {
    continueButtons: await invalidPage.getByRole("button", { name: /Continue/ }).count(),
    storageCleared: await invalidPage.evaluate(() => localStorage.getItem("navodaya.campus.save.v1") === null),
  };
  console.log("Student/house mismatch rejected:", mismatchResult);
  await invalidContext.close();
} catch (error) {
  console.error("TEST FAILURE:", error.message);
  await page.screenshot({ path: ".verify/house-failure.png" }).catch(() => undefined);
  process.exitCode = 1;
}

console.log("Console errors:", errors.length);
errors.slice(0, 20).forEach((error) => console.log("  ERR", error));
console.log("Console warnings:", warnings.length);
warnings.slice(0, 8).forEach((warning) => console.log("  WARN", warning));
await browser.close();
