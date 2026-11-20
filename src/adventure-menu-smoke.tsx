import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { AdventureMenu } from "./game/ui/AdventureMenu";
import type { GameUIState } from "./game/core/types";

const state = {
  profile: null,
  escapeSave: null,
  night: null,
  nightResult: null,
} as unknown as GameUIState;

const html = renderToStaticMarkup(
  <MemoryRouter>
    <AdventureMenu state={state} engine={null} />
  </MemoryRouter>,
);

const checks: Array<[boolean, string]> = [
  [html.includes('data-testid="adventure-mess-run"'), "MESS RUN card renders"],
  [html.includes('href="/mess-run?returnTo=adventure"'), "MESS RUN card targets the real game route"],
  [html.includes("MESS RUN"), "MESS RUN title renders"],
  [html.toLowerCase().includes("the great food escape"), "MESS RUN subtitle renders"],
  [html.includes("PLAYABLE · MINI-GAME"), "MESS RUN status renders"],
  [html.includes('data-testid="adventure-mess-meal"'), "existing MESS MEAL card remains"],
  [html.includes('data-testid="adventure-class-bunk"'), "existing CLASS BUNK card remains"],
  [html.includes('data-testid="adventure-night"'), "existing night caper remains"],
  [html.includes('data-testid="adventure-escape"'), "existing Campus Escape remains"],
  [html.includes('data-testid="adventure-back"'), "existing Back control remains"],
];

let failed = 0;
for (const [ok, label] of checks) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed += 1;
}
console.log(`\nResult: ${checks.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
