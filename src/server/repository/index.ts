import "server-only";
import type { Repository } from "./types";

/** Demo mode = no DATABASE_URL → in-memory store seeded with sample data. */
export const isDemoData = !process.env.DATABASE_URL;

/*
 * One repository per server process, cached on globalThis so hot reloads and
 * every route bundle share it — the data folder is imported once per start.
 * The key is fixed on purpose: a per-version key made bundles compiled at
 * different times reset each other's cache and re-import on every request.
 * REPO_SHAPE is bumped when the Repository interface changes, so a running dev
 * server builds a fresh repository once instead of serving the stale object.
 */
const REPO_SHAPE = 4; // 4 = personal notes (repo.notes); 3 = access matrix
const g = globalThis as unknown as { __iodRepository?: Promise<Repository>; __iodRepositoryShape?: number };

async function init(): Promise<Repository> {
  const repo = isDemoData
    ? (await import("./memory")).memoryRepository
    : (await import("./prisma")).prismaRepository;

  // Local development: load the source files from a folder on disk (never committed).
  const dir = process.env.DATA_IMPORT_DIR;
  if (isDemoData && dir) {
    const { importDirectory } = await import("@/server/ingest");
    await importDirectory(repo, dir);
  }
  return repo;
}

export function getRepo(): Promise<Repository> {
  // Only ever upgrade: a bundle compiled before the bump must not reset a newer repository.
  if ((g.__iodRepositoryShape ?? 0) < REPO_SHAPE) {
    g.__iodRepository = undefined;
    g.__iodRepositoryShape = REPO_SHAPE;
  }
  g.__iodRepository ??= init().catch((err) => {
    g.__iodRepository = undefined;
    throw err;
  });
  return g.__iodRepository;
}
