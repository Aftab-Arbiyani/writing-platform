import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { User } from './entities/user.entity';

/**
 * Data access for the `users` aggregate (docs 16 §3.3 — only repositories touch
 * TypeORM). Every method accepts an optional `EntityManager` so a service can
 * run it inside a transaction (docs 16 §3.5). Reads exclude soft-deleted rows by
 * default; uniqueness checks include them (a permanent username/email stays
 * claimed, docs 04 §1.5).
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly dataSource: DataSource) {}

  private repo(manager?: EntityManager): Repository<User> {
    return (manager ?? this.dataSource.manager).getRepository(User);
  }

  findById(id: string, manager?: EntityManager): Promise<User | null> {
    return this.repo(manager).findOne({ where: { id } });
  }

  findByEmail(email: string, manager?: EntityManager): Promise<User | null> {
    return this.repo(manager).findOne({ where: { email } });
  }

  findByUsername(username: string, manager?: EntityManager): Promise<User | null> {
    return this.repo(manager).findOne({ where: { username } });
  }

  /** Includes soft-deleted rows — a claimed email is never released (docs 04 §1.5). */
  async existsByEmail(email: string, manager?: EntityManager): Promise<boolean> {
    const count = await this.repo(manager).count({ where: { email }, withDeleted: true });
    return count > 0;
  }

  /** Includes soft-deleted rows — a claimed username is permanent (docs 04 §1.5). */
  async existsByUsername(username: string, manager?: EntityManager): Promise<boolean> {
    const count = await this.repo(manager).count({ where: { username }, withDeleted: true });
    return count > 0;
  }

  create(data: Partial<User>, manager?: EntityManager): Promise<User> {
    const repo = this.repo(manager);
    return repo.save(repo.create(data));
  }

  async update(id: string, patch: Partial<User>, manager?: EntityManager): Promise<void> {
    await this.repo(manager).update({ id }, patch);
  }
}
