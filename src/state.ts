export type Engine = "postgres" | "mysql";

export const state: { engine: Engine | null } = { engine: null };
