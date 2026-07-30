import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { Profile } from './entities/profile.entity';
import { ProfileGenre } from './entities/profile-genre.entity';

/** Data access for `profiles` + `profile_genres` (docs 16 §3.3). */
@Injectable()
export class ProfileRepository {
  constructor(private readonly dataSource: DataSource) {}

  private manager(manager?: EntityManager): EntityManager {
    return manager ?? this.dataSource.manager;
  }

  private repo(manager?: EntityManager): Repository<Profile> {
    return this.manager(manager).getRepository(Profile);
  }

  findByUserId(userId: string, manager?: EntityManager): Promise<Profile | null> {
    return this.repo(manager).findOne({ where: { userId } });
  }

  create(data: Partial<Profile>, manager?: EntityManager): Promise<Profile> {
    const repo = this.repo(manager);
    return repo.save(repo.create(data));
  }

  async update(userId: string, patch: Partial<Profile>, manager?: EntityManager): Promise<void> {
    await this.repo(manager).update({ userId }, patch);
  }

  /**
   * Race-safe counter delta (docs 04 §7 — never read-modify-write). Deltas are
   * server-controlled small integers, passed as bound parameters (docs 13 §6).
   */
  async incrementCounts(
    userId: string,
    deltas: { followers?: number; following?: number; pieces?: number },
    manager?: EntityManager,
  ): Promise<void> {
    await this.manager(manager).query(
      `UPDATE profiles
         SET followers_count = followers_count + $1,
             following_count = following_count + $2,
             pieces_count    = pieces_count + $3
       WHERE user_id = $4`,
      [deltas.followers ?? 0, deltas.following ?? 0, deltas.pieces ?? 0, userId],
    );
  }

  getGenreIds(profileId: string, manager?: EntityManager): Promise<string[]> {
    return this.manager(manager)
      .getRepository(ProfileGenre)
      .find({ where: { profileId }, select: { genreId: true } })
      .then((rows) => rows.map((r) => r.genreId));
  }

  /** Replaces the profile's genre set (delete-all + insert) inside a transaction. */
  async setGenres(profileId: string, genreIds: string[], manager: EntityManager): Promise<void> {
    const repo = manager.getRepository(ProfileGenre);
    await repo.delete({ profileId });
    if (genreIds.length > 0) {
      await repo.save(genreIds.map((genreId) => repo.create({ profileId, genreId })));
    }
  }
}
