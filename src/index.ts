import {
  ENGINES,
  attachInteractive,
  cleanupAll,
  isDockerAvailable,
  seedSampleDb,
  startContainer,
  stopAndRemove,
  tailLogs,
  waitReady,
} from "./docker.js";
import { engineMenu, topMenu, type TopChoice } from "./menu.js";
import { state } from "./state.js";

let shuttingDown = false;

async function shutdown(code = 0): Promise<void> {
  if (shuttingDown) {
    process.exit(code === 0 ? 130 : code);
  }
  shuttingDown = true;
  console.log("\nCleaning up containers...");
  try {
    await cleanupAll();
  } catch {
    /* best effort */
  }
  process.exit(code);
}

process.on("SIGINT", () => {
  void shutdown(130);
});
process.on("SIGTERM", () => {
  void shutdown(143);
});

function isExitPromptError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "ExitPromptError" ||
    /force closed the prompt/i.test(err.message)
  );
}

async function chooseEngine(): Promise<void> {
  const pick = await engineMenu();
  if (pick === "back") return;

  if (state.engine && state.engine !== pick) {
    console.log(`Stopping ${ENGINES[state.engine].label}...`);
    await stopAndRemove(state.engine);
    state.engine = null;
    state.sampleDbLoaded = false;
  }

  const cfg = ENGINES[pick];
  console.log(`Starting ${cfg.label} (${cfg.image})...`);
  try {
    await startContainer(pick);
  } catch (err) {
    console.log(`Failed to start: ${(err as Error).message}`);
    return;
  }

  console.log(`Waiting for ${cfg.label} to be ready (up to 60s)...`);
  try {
    await waitReady(pick);
  } catch (err) {
    console.log((err as Error).message);
    const logs = await tailLogs(pick);
    if (logs) {
      console.log("--- Last container logs ---");
      console.log(logs);
      console.log("---");
    }
    await stopAndRemove(pick);
    return;
  }

  state.engine = pick;
  console.log(`${cfg.label} is ready.`);

  console.log("Loading sample database...");
  try {
    await seedSampleDb(pick);
    state.sampleDbLoaded = true;
    console.log("Sample database loaded.\n");
  } catch (err) {
    console.log(
      `Sample database could not be loaded: ${(err as Error).message}`,
    );
    console.log("The engine is still usable.\n");
  }
}

function printSampleDbDiagram(): void {
  console.log(`----------------------------------------------------------------------------
Sample database: bookstore.
Relations:

  authors ──< books ──< orders >── customers

Columns:
  authors    (id, name, country)
  books      (id, author_id → authors, title, published_year, price)
  customers  (id, email, name)
  orders     (id, customer_id → customers, book_id → books, quantity, order_date)

Indexes: books(author_id), orders(customer_id), orders(book_id), orders(order_date)
----------------------------------------------------------------------------`);
}

async function runSql(): Promise<void> {
  if (!state.engine) return;
  const cfg = ENGINES[state.engine];
  if (state.sampleDbLoaded) {
    console.log();
    printSampleDbDiagram();
  }
  console.log(
    `\nLaunching the ${cfg.label} client inside ${cfg.containerName}. Type \\q to return.\n`,
  );
  const code = await attachInteractive(state.engine);
  if (code !== 0) {
    console.log(`(client exited with code ${code})`);
  }
  console.log();
}

async function main(): Promise<void> {
  if (!(await isDockerAvailable())) {
    console.error(
      "Docker doesn't seem to be running. Start it and try again.",
    );
    process.exit(1);
  }

  await cleanupAll();

  while (true) {
    let choice: TopChoice;
    try {
      choice = await topMenu();
    } catch (err) {
      if (isExitPromptError(err)) {
        choice = "quit";
      } else {
        throw err;
      }
    }

    if (choice === "choose") {
      try {
        await chooseEngine();
      } catch (err) {
        if (!isExitPromptError(err)) throw err;
      }
    } else if (choice === "run") {
      await runSql();
    } else {
      break;
    }
  }

  await shutdown(0);
}

main().catch(async (err) => {
  console.error(`Unexpected error: ${(err as Error).message}`);
  await shutdown(1);
});
