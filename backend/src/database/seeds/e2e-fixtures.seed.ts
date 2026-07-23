import 'dotenv/config';
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Role } from '@qalam/shared';

import { AppModule } from '../../app.module';
import { TransactionRunner } from '../../common/database/transaction-runner';
import { PasswordService } from '../../modules/auth/services/password.service';
import { CreatePieceDto } from '../../modules/pieces/dto/create-piece.dto';
import { PiecesService } from '../../modules/pieces/pieces.service';
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
