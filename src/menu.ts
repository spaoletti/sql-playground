import { select } from "@inquirer/prompts";
import { ENGINES } from "./docker.js";
import { state, type Engine } from "./state.js";

export type TopChoice = "choose" | "run" | "quit";
export type EngineChoice = Engine | "back";

export function topMenu(): Promise<TopChoice> {
  const activeLabel = state.engine ? ENGINES[state.engine].label : "none";
  return select<TopChoice>({
    message: `sql-playground  (active DB: ${activeLabel})`,
    choices: [
      { name: "Choose a DB", value: "choose" },
      {
        name: "Run SQL",
        value: "run",
        disabled: state.engine ? false : "(choose a DB first)",
      },
      { name: "Stop & quit", value: "quit" },
    ],
  });
}

export function engineMenu(): Promise<EngineChoice> {
  return select<EngineChoice>({
    message: "Pick an engine (always :latest)",
    choices: [
      { name: ENGINES.postgres.label, value: "postgres" },
      { name: ENGINES.mysql.label, value: "mysql" },
      { name: "Back", value: "back" },
    ],
  });
}
