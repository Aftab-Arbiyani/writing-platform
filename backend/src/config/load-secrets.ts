/**
 * Container-secret loader (P7.1 "Secret Injection" / "Container Secrets").
 *
 * Runs once, before `validateEnv`, so secrets mounted as files by Docker
 * (`/run/secrets/*`), Kubernetes (projected volumes) or CI can be consumed
 * without ever landing in the process environment of a parent shell (which is
 * visible via `/proc/<pid>/environ`). Two conventions are supported:
 *
 *   1. `<VAR>_FILE=/path`  → reads the file into `<VAR>` (12-factor / Docker
 *      Swarm / Compose `secrets:` convention). E.g. `JWT_ACCESS_SECRET_FILE`.
 *   2. `SECRETS_DIR=/run/secrets` → every regular file in the directory is
 *      loaded as `<FILENAME>=<contents>` (Docker/K8s default mount layout).
 *
 * A directly-set env var always wins over its file form (explicit override).
 * Values are trimmed of a single trailing newline (how `echo`/`printf` and most
 * secret stores write files). Secret *names* are returned for a boot log line;
 * secret *values* are never logged or returned.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface LoadedSecrets {
  /** Names of env vars populated from a file (for a redaction-safe boot log). */
  readonly loaded: string[];
  readonly source: 'none' | 'file-refs' | 'secrets-dir' | 'both';
}

function readSecretFile(path: string): string {
  // A single trailing newline is stripped; interior whitespace is preserved.
  return readFileSync(path, 'utf8').replace(/\n$/, '');
}

/**
 * Populate `env` from file-mounted secrets. Mutates `env` in place (defaults to
 * `process.env`). Throws if a referenced file cannot be read — a mounted secret
 * that is missing is a hard misconfiguration and must fail fast at boot.
 */
export function loadContainerSecrets(env: NodeJS.ProcessEnv = process.env): LoadedSecrets {
  const loaded: string[] = [];
  let usedFileRefs = false;
  let usedDir = false;

  // (1) <VAR>_FILE indirection.
  for (const key of Object.keys(env)) {
    if (!key.endsWith('_FILE')) continue;
    const target = key.slice(0, -'_FILE'.length);
    if (target.length === 0) continue;
    const path = env[key];
    if (path === undefined || path.length === 0) continue;
    if (env[target] !== undefined && env[target] !== '') continue; // explicit value wins
    try {
      env[target] = readSecretFile(path);
    } catch (err) {
      throw new Error(
        `container secret ${key}=${path} could not be read: ${(err as Error).message}`,
      );
    }
    loaded.push(target);
    usedFileRefs = true;
  }

  // (2) SECRETS_DIR — one file per secret, filename = env var name.
  const dir = env.SECRETS_DIR;
  if (dir !== undefined && dir.length > 0) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch (err) {
      throw new Error(`SECRETS_DIR=${dir} could not be listed: ${(err as Error).message}`);
    }
    for (const name of entries) {
      const full = join(dir, name);
      try {
        if (!statSync(full).isFile()) continue;
      } catch {
        continue;
      }
      if (env[name] !== undefined && env[name] !== '') continue; // explicit value wins
      env[name] = readSecretFile(full);
      loaded.push(name);
      usedDir = true;
    }
  }

  const source: LoadedSecrets['source'] =
    usedFileRefs && usedDir
      ? 'both'
      : usedFileRefs
        ? 'file-refs'
        : usedDir
          ? 'secrets-dir'
          : 'none';

  return { loaded, source };
}
