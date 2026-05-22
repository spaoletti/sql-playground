export type Engine = "postgres" | "mysql";

export const state: { engine: Engine | null; sampleDbLoaded: boolean } = {
  engine: null,
  sampleDbLoaded: false,
};
