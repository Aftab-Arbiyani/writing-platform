import 'dotenv/config';
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Role, UNLIMITED_SEATS } from '@qalam/shared';

import { AppModule } from '../../app.module';
import { TransactionRunner } from '../../common/database/transaction-runner';
import { PasswordService } from '../../modules/auth/services/password.service';
import { CreatePieceDto } from '../../modules/pieces/dto/create-piece.dto';
import { PiecesService } from '../../modules/pieces/pieces.service';
import { SettingsService } from '../../modules/settings/settings.service';
import { RolesService } from '../../modules/users/roles.service';
import { UsersService } from '../../modules/users/users.service';

/**
 * E2E fixtures seed (docs/e2e/04 §3) — the deterministic baseline the browser
 * suite logs in as and reads. Creates a VERIFIED writer (`user` role) plus a
 * couple of published pieces, reusing the real services so the records are
 * indistinguishable from user-created ones.
 *
 * Guard rails:
 * - Idempotent: insert-if-missing by email (safe to re-run every `stack-up`).
 * - Non-production: REFUSES to run when NODE_ENV === 'production' — a
 *   known-password writer must never land in prod (mirrors super-admin.seed).
 * - Insert/upsert only. Never deletes (docs/e2e/09 — no hard-delete / no DDL).
 * - Run AFTER the base seed (`run-seeds.ts`) so roles/permissions/taxonomy exist;
 *   this file also re-asserts them so it is safe to run standalone.
 *
 * Credentials come from env with dev defaults (never used in prod, which is
 * gated above): E2E_WRITER_EMAIL / E2E_WRITER_USERNAME / E2E_WRITER_PASSWORD.
 */

const DEV_DEFAULTS = {
  email: 'writer@qalam.local',
  username: 'e2e_writer',
  password: 'ChangeMe!Writer1',
} as const;

/** A minimal, non-empty TipTap doc so the piece is publishable (wordCount > 0). */
function tiptapDoc(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

const SAMPLE_PIECES: ReadonlyArray<{ title: string; genreSlug: string; body: string }> = [
  {
    title: 'E2E Sample — The Lamplighter',
    genreSlug: 'short-story',
    body: 'A quiet story seeded for end-to-end tests. It exists so read-only feed, profile, and search specs have deterministic, publishable content to find.',
  },
  {
    title: 'E2E Sample — Letters to the Morning',
    genreSlug: 'essay',
    body: 'A second seeded piece. Deterministic words give this piece a non-zero word count so it can be published and discovered by the browser suite.',
  },
];

/** The actor every audit row from this seed is attributed to — a script, not a person. */
const SEED_ACTOR = {
  id: '00000000-0000-0000-0000-000000000000',
  role: Role.SuperAdmin as string,
  ip: null,
  userAgent: 'seed:e2e',
  requestId: null,
} as const;

/**
 * Lift the free plan's **piece cap and collaborator seat cap** for THIS STACK ONLY
 * (`monetization.plans` → `free.limits`).
 *
 * **Why the suite cannot run without it.** B4 caps the free plan at 25 pieces, and almost every
 * browser spec arranges its own content as the ONE shared seeded writer (`api.createPublishedPiece`
 * → `POST /pieces`, the only create path the cap gates). The 26th piece in a run is a
 * `402 PIECE_LIMIT_REACHED` in *arrange*, so the specs fail before they assert anything — and the
 * suite creates far more than 25 in a single pass, so this bites a FRESH database too, not just a
 * long-lived local one. Found by W7a's run against a stack with 4,262 writer pieces, where 8 of
 * `reader.spec.ts`'s 10 tests failed identically (docs/48 §3.14, **B4-1**).
 *
 * **Why here and not in a spec.** It is a property of the stack, like `RATE_LIMIT_ENABLED=false`
 * next door in `stack-up.sh`: the auth rate limit is real product behaviour that a suite minting a
 * login per test must not be judged by, and so is this. No spec asserts the cap, so nothing loses
 * coverage; if one is ever written, it should arrange its own author rather than the shared writer.
 *
 * **The seat cap is the same defect, found the same way, twenty days later.** B6 caps free-plan
 * collaborators — and it is the ONE limit key with an INVERTED sentinel: `-1` ({@link UNLIMITED_SEATS})
 * means unlimited and `0` means NONE, the opposite of every other key including `maxPieces` two lines
 * below. Free ships `0`, so `POST /stories/:id/invitations` answers
 * `402 COLLABORATOR_LIMIT_REACHED` ("Your plan allows 0 collaborators per story") for the shared
 * seeded writer, and all three membership specs fail in *arrange*. Measured 2026-08-20 by running the
 * frontend suite in the pinned image: **the same three failed on chromium AND webkit**, which is what
 * ruled out the engine and pointed here (docs/48 §3.22c).
 *
 * Nobody had noticed because B6 landed 2026-08-08 and the frontend functional suite had not been run
 * since. That is B4-1's lesson repeating: a plan limit added later silently disarms the fixtures of
 * specs written before it, and the failure surfaces in arrange, where it reads as a broken selector.
 *
 * Written UNCONDITIONALLY, outside the writer's insert-if-missing guard, so an already-seeded stack
 * (the common case — `stack-up` is re-run constantly) picks the fix up without a `--reset`. It is
 * an idempotent settings write.
 */
async function liftPlanCapsForE2e(
  app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>,
  logger: Logger,
): Promise<void> {
  const settings = app.get(SettingsService);
  const current = (await settings.getValue('monetization.plans')) as Record<
    string,
    { limits?: Record<string, unknown> }
  > | null;
  if (current === null || typeof current !== 'object' || current.free === undefined) {
    logger.warn('monetization.plans has no `free` tier; leaving the piece cap alone.');
    return;
  }
  // BOTH caps, or the second one would never be lifted on a stack that already had the first.
  if (
    current.free.limits?.maxPieces === 0 &&
    current.free.limits?.maxCollaborators === UNLIMITED_SEATS
  ) {
    logger.log('E2E plan caps already lifted (free.maxPieces = 0, maxCollaborators = -1).');
    return;
  }

  // Merge, never replace: the blob also carries the plus/pro/patron tiers and every price, and this
  // seed has no business rewriting any of them.
  const patched = {
    ...current,
    free: {
      ...current.free,
      limits: {
        ...current.free.limits,
        // `0` = unlimited here (B4's convention) …
        maxPieces: 0,
        // … and `-1` = unlimited HERE, because B6 inverts it for this key alone. Writing `0` would
        // mean "no collaborators at all", i.e. exactly the state being fixed.
        maxCollaborators: UNLIMITED_SEATS,
      },
    },
  };
  await settings.updateSettings(
    [{ key: 'monetization.plans', value: patched }],
    { ...SEED_ACTOR },
    'seed:e2e — lift the free-plan piece and collaborator caps so the browser suite can arrange content (48 §3.14 B4-1, §3.22c)',
  );
  logger.log(
    'E2E plan caps lifted: free.limits.maxPieces = 0, maxCollaborators = -1 (both unlimited).',
  );
}

async function seedE2eFixtures(): Promise<void> {
  const logger = new Logger('SeedE2E');

  if ((process.env.NODE_ENV ?? 'development') === 'production') {
    logger.warn('E2E fixtures seed SKIPPED: refuses to run in production (docs/e2e/04 §3.2).');
    return;
  }

  const email = (process.env.E2E_WRITER_EMAIL ?? DEV_DEFAULTS.email).trim().toLowerCase();
  const username = (process.env.E2E_WRITER_USERNAME ?? DEV_DEFAULTS.username).trim().toLowerCase();
  const password = process.env.E2E_WRITER_PASSWORD ?? DEV_DEFAULTS.password;

  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  try {
    const users = app.get(UsersService);
    const roles = app.get(RolesService);
    const passwords = app.get(PasswordService);
    const transactions = app.get(TransactionRunner);
    const pieces = app.get(PiecesService);

    // Stack-level, and so outside the insert-if-missing guard below: an existing stack must pick
    // this up without a `--reset`, because without it the browser suite cannot arrange content.
    await liftPlanCapsForE2e(app, logger);

    // Idempotent by email: an existing writer means the fixtures already ran, so
    // leave both the account and its pieces untouched (no re-hash, no duplicates).
    const existing = await users.findByEmail(email);
    if (existing !== null) {
      logger.log(`E2E writer already present (${email}); fixtures left untouched.`);
      return;
    }

    passwords.assertStrong(password);
    const passwordHash = await passwords.hash(password);
    const writer = await transactions.run(async (manager) => {
      const created = await users.createLocalUser({ email, username, passwordHash }, manager);
      // Pre-verify: the E2E writer must log in without an email round-trip.
      await users.markEmailVerified(created.id, manager);
      // `user` is the default effective role, but grant it explicitly so the
      // fixture is unambiguous and future role assertions have something to read.
      await roles.grantRole(created.id, Role.User, null, manager);
      return created;
    });
    logger.log(`E2E writer created: ${email} (username: ${username}, role: user, verified).`);

    // Seed the sample published pieces (only on fresh writer creation).
    for (const sample of SAMPLE_PIECES) {
      const dto = new CreatePieceDto();
      Object.assign(dto, {
        title: sample.title,
        languageCode: 'en',
        genreSlug: sample.genreSlug,
        content: tiptapDoc(sample.body),
        // visibility omitted → DTO defaults to 'public'.
      } satisfies Partial<CreatePieceDto>);
      const draft = await pieces.createDraft(writer.id, dto);
      await pieces.publish(draft.id, writer.id);
      logger.log(`E2E sample piece published: "${sample.title}".`);
    }
  } finally {
    await app.close();
  }
}

seedE2eFixtures().catch((error: unknown) => {
  console.error('E2E fixtures seeding failed:', error);
  process.exit(1);
});
