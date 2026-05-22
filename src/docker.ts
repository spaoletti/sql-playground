import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { Engine } from "./state.js";

type EngineConfig = {
  containerName: string;
  image: string;
  hostPort: number;
  containerPort: number;
  env: Record<string, string>;
  readyCheck: string[];
  clientCmd: string[];
  seedCmd: string[];
  clientEnv?: Record<string, string>;
  label: string;
};

export const ENGINES: Record<Engine, EngineConfig> = {
  postgres: {
    containerName: "sql-playground-postgres",
    image: "postgres:latest",
    hostPort: 5432,
    containerPort: 5432,
    env: { POSTGRES_PASSWORD: "playground", POSTGRES_DB: "playground" },
    readyCheck: ["pg_isready", "-U", "postgres", "-d", "playground"],
    clientCmd: ["psql", "-U", "postgres", "-d", "playground"],
    seedCmd: [
      "psql",
      "-U",
      "postgres",
      "-d",
      "playground",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    label: "PostgreSQL",
  },
  mysql: {
    containerName: "sql-playground-mysql",
    image: "mysql:latest",
    hostPort: 3306,
    containerPort: 3306,
    env: {
      MYSQL_ROOT_PASSWORD: "playground",
      MYSQL_DATABASE: "playground",
    },
    readyCheck: ["mysqladmin", "ping", "-uroot", "-pplayground", "--silent"],
    clientCmd: ["mysql", "-uroot", "playground"],
    seedCmd: ["mysql", "-uroot", "playground"],
    clientEnv: { MYSQL_PWD: "playground" },
    label: "MySQL",
  },
};

const SAMPLE_DB_SQL_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "sample-db",
  "schema.sql",
);

type CaptureResult = { code: number; stdout: string; stderr: string };

function dockerCapture(args: string[]): Promise<CaptureResult> {
  return new Promise((resolve) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    child.on("error", (err) =>
      resolve({ code: -1, stdout, stderr: stderr + String(err) }),
    );
  });
}

function dockerCaptureWithInput(
  args: string[],
  input: string,
): Promise<CaptureResult> {
  return new Promise((resolve) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    child.on("error", (err) =>
      resolve({ code: -1, stdout, stderr: stderr + String(err) }),
    );
    child.stdin.write(input);
    child.stdin.end();
  });
}

function dockerAttach(args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("docker", args, { stdio: "inherit" });
    child.on("close", (code) => resolve(code ?? -1));
    child.on("error", () => resolve(-1));
  });
}

export async function isDockerAvailable(): Promise<boolean> {
  const result = await dockerCapture(["info"]);
  return result.code === 0;
}

async function containerExists(name: string): Promise<boolean> {
  const { stdout } = await dockerCapture([
    "ps",
    "-a",
    "--filter",
    `name=${name}`,
    "--format",
    "{{.Names}}",
  ]);
  return stdout
    .split("\n")
    .map((s) => s.trim())
    .includes(name);
}

export async function stopAndRemove(engine: Engine): Promise<void> {
  const name = ENGINES[engine].containerName;
  if (!(await containerExists(name))) return;
  await dockerCapture(["rm", "-f", name]);
}

export async function startContainer(engine: Engine): Promise<void> {
  const cfg = ENGINES[engine];
  if (await containerExists(cfg.containerName)) {
    await dockerCapture(["rm", "-f", cfg.containerName]);
  }
  const args = [
    "run",
    "-d",
    "--name",
    cfg.containerName,
    "-p",
    `${cfg.hostPort}:${cfg.containerPort}`,
  ];
  for (const [k, v] of Object.entries(cfg.env)) {
    args.push("-e", `${k}=${v}`);
  }
  args.push(cfg.image);
  const result = await dockerCapture(args);
  if (result.code !== 0) {
    const msg = result.stderr.trim() || result.stdout.trim() || "unknown error";
    throw new Error(`docker run failed: ${msg}`);
  }
}

export async function waitReady(
  engine: Engine,
  timeoutMs = 60_000,
): Promise<void> {
  const cfg = ENGINES[engine];
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await dockerCapture([
      "exec",
      cfg.containerName,
      ...cfg.readyCheck,
    ]);
    if (result.code === 0) return;
    await sleep(500);
  }
  throw new Error(
    `${cfg.label} did not become ready within ${timeoutMs / 1000}s`,
  );
}

export async function seedSampleDb(engine: Engine): Promise<void> {
  const cfg = ENGINES[engine];
  const sql = await readFile(SAMPLE_DB_SQL_PATH, "utf8");
  const args = ["exec", "-i"];
  if (cfg.clientEnv) {
    for (const [k, v] of Object.entries(cfg.clientEnv)) {
      args.push("-e", `${k}=${v}`);
    }
  }
  args.push(cfg.containerName, ...cfg.seedCmd);
  const result = await dockerCaptureWithInput(args, sql);
  if (result.code !== 0) {
    const msg = result.stderr.trim() || result.stdout.trim() || "unknown error";
    throw new Error(msg);
  }
}

export async function attachInteractive(engine: Engine): Promise<number> {
  const cfg = ENGINES[engine];
  const args = ["exec", "-it"];
  if (cfg.clientEnv) {
    for (const [k, v] of Object.entries(cfg.clientEnv)) {
      args.push("-e", `${k}=${v}`);
    }
  }
  args.push(cfg.containerName, ...cfg.clientCmd);
  return dockerAttach(args);
}

export async function tailLogs(engine: Engine, lines = 30): Promise<string> {
  const cfg = ENGINES[engine];
  const { stdout, stderr } = await dockerCapture([
    "logs",
    "--tail",
    String(lines),
    cfg.containerName,
  ]);
  return (stdout + stderr).trim();
}

export async function cleanupAll(): Promise<void> {
  for (const engine of Object.keys(ENGINES) as Engine[]) {
    await stopAndRemove(engine);
  }
}
