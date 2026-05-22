# sql-playground

A tiny CLI that spins up a throwaway PostgreSQL or MySQL container and drops you into `psql` / `mysql`. 
Quit and it cleans up after itself. Handy when you want to poke at some SQL.

## What you need

- [Docker](https://www.docker.com/) — running, not just installed.
- [Node.js](https://nodejs.org/) 20+
- npm

## Setup

```sh
npm install
```

## Run

```sh
npm start
```

You'll get a menu:

1. **Choose a DB** — pick Postgres or MySQL. The matching `:latest` image is pulled (first time only) and started.
2. **Run SQL** — drops you into the engine's native client. Type `\q` (Postgres) or `exit` (MySQL) to come back.
3. **Stop & quit** — tears down the container and exits.

Ctrl+C also works and will clean up before exiting.

## Notes

- Root password is `playground` if you ever need it.
- Containers are named `sql-playground-postgres` / `sql-playground-mysql` and use host ports 5432 / 3306.
- Nothing is persisted — when the container goes, your data goes with it.
