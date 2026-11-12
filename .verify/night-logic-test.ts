import { NightMissionSystem } from "../src/game/systems/NightMissionSystem";
import { GARDEN_ITEM_IDS, NIGHT_TOTAL_STEPS } from "../src/game/data/night";

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) console.log("PASS", label);
  else {
    failures += 1;
    console.log("FAIL", label, detail === undefined ? "" : JSON.stringify(detail));
  }
}

const night = new NightMissionSystem();
const started = night.startNew();
check("starts active at objective 1", started.active && started.step === 0 && started.attempts === 1, started);
check("cannot collect before challenge", night.collect("tomato").ok === false);

const challenge = night.startChallenge("aravali");
check("challenge speaker is roommate", challenge.speaker === "Your roommate" && challenge.role.includes("Aravali"));
check("challenge starts on wake node", challenge.text.includes("Lights out") && !challenge.canAdvance, challenge);
check("advance moves to plan with choices", night.advanceDialogue() === false && night.currentView().choices.length === 2);
check("choose why branch", night.chooseDialogue(0) && night.currentView().text.includes("practical botany"));
check("advance from why to go", night.advanceDialogue() === false && night.currentView().text.includes("south path"));
check("advance ends challenge dialogue", night.advanceDialogue() === true);
check("meetRoommate completes both dialogue objectives", night.meetRoommate() && night.currentStepId === "reach-garden", night.currentStepId);

check("reachGarden advances to harvesting", night.reachGarden() && night.currentStepId === "collect-vegetables");
check("unknown item rejected", night.collect("pumpkin" as never).ok === false);
check("first item collected", night.collect("tomato").ok && night.collected.length === 1);
const duplicate = night.collect("tomato");
check("duplicate item rejected", !duplicate.ok && duplicate.reason?.includes("already"), duplicate);
for (const item of GARDEN_ITEM_IDS.filter((id) => id !== "tomato")) {
  const result = night.collect(item);
  check(`collect ${item}`, result.ok);
}
check("four unique items collected", night.collected.length === 4, night.collected);
check("collection advances to return-home", night.currentStepId === "return-home", night.currentStepId);
check("cannot collect after limit", night.collect("tomato").ok === false);
check("returnHome succeeds", night.returnHome() && !night.active && night.success && night.collected.length === 4, {
  active: night.active,
  success: night.success,
  collected: night.collected,
});
const successSave = night.toSave();
check("success save records completion", successSave.success && !successSave.active && successSave.step === NIGHT_TOTAL_STEPS && successSave.completedAt !== null, successSave);

const replay = new NightMissionSystem();
const replayView = replay.startNew(successSave);
check("replay preserves completedOnce and increments attempts", replayView.completedOnce && replayView.attempts === 2, replayView);
check("replay resets mission to start", replayView.step === 0 && replayView.active, replayView);

const caught = new NightMissionSystem();
caught.startNew();
caught.meetRoommate();
caught.reachGarden();
caught.collect("tomato");
caught.fail();
check("caught fails without success and clears bag", !caught.active && caught.caught && !caught.success && caught.collected.length === 0, caught.toSave());
const caughtDialogue = caught.startCaught();
check("caught dialogue names teacher and mess", caughtDialogue.speaker === "Mr. Barua" && caughtDialogue.text.includes("school mess"), caughtDialogue);
check("caught dialogue advances", caught.advanceDialogue() === false && caught.advanceDialogue() === true);

const restored = new NightMissionSystem();
const restoredView = restored.restore({
  active: true,
  started: true,
  step: 3,
  collected: ["tomato", "potato"],
  attempts: 2,
  caught: false,
  success: false,
  completedAt: null,
});
check("restore active progress", restoredView.active && restoredView.step === 3 && restoredView.collected.length === 2, restoredView);

const restoredSuccess = new NightMissionSystem();
const restoredSuccessView = restoredSuccess.restore(successSave);
check("restore success", restoredSuccessView.completedOnce && !restoredSuccessView.active, restoredSuccessView);

console.log(failures === 0 ? "NIGHT_LOGIC_OK" : `NIGHT_LOGIC_FAILED:${failures}`);
if (failures > 0) process.exit(1);
