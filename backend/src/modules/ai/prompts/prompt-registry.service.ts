import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PromptCategory } from '@qalam/shared';
import { Repository } from 'typeorm';

import { AiPromptNotFoundException } from '../ai.exceptions';
import { TokenCounterService } from '../tokens/token-counter.service';
import { AI_PROMPT_CATALOG } from './prompt-catalog';
import { AiPromptTemplate } from './entities/ai-prompt-template.entity';
import { renderTemplate, validateTemplateBody } from './prompt-renderer';

/** A resolved prompt template (a specific version). */
export interface ResolvedPrompt {
  key: string;
  version: number;
  category: PromptCategory;
  description: string;
  body: string;
  variables: string[];
  active: boolean;
  updatedAt: Date;
}

/**
 * The prompt registry (AF1): templates, versioning, categories, validation,
 * rendering, preview. Catalogue-seeded + DB-backed (guarded), mirroring the model
 * registry. Serves the active version by default; admins add versions + flip the
 * active one. Rendering delegates to the single shared renderer — no duplication.
 */
@Injectable()
export class PromptRegistryService implements OnModuleInit {
  private readonly logger = new Logger(PromptRegistryService.name);
  /** key -> (version -> template). */
  private readonly templates = new Map<string, Map<number, ResolvedPrompt>>();

  constructor(
    @InjectRepository(AiPromptTemplate) private readonly repo: Repository<AiPromptTemplate>,
    private readonly tokenCounter: TokenCounterService,
  ) {
    for (const entry of AI_PROMPT_CATALOG) {
      this.put({
        key: entry.key,
        version: 1,
        category: entry.category,
        description: entry.description,
        body: entry.body,
        variables: [...entry.variables],
        active: true,
        updatedAt: new Date(0),
      });
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.syncCatalog();
      await this.hydrateFromDb();
    } catch (error) {
      this.logger.warn(
        `AI prompt registry serving in-memory catalogue (DB sync skipped): ${String(error)}`,
      );
    }
  }

  /** Active version of every key. */
  listActive(): ResolvedPrompt[] {
    return [...this.templates.values()]
      .map((versions) => [...versions.values()].find((template) => template.active))
      .filter((template): template is ResolvedPrompt => template !== undefined);
  }

  /** All versions of one key (newest first). */
  listVersions(key: string): ResolvedPrompt[] {
    const versions = this.templates.get(key);
    if (versions === undefined) {
      throw new AiPromptNotFoundException(key);
    }
    return [...versions.values()].sort((a, b) => b.version - a.version);
  }

  /** The active version (or a specific version) of a key. */
  get(key: string, version?: number): ResolvedPrompt {
    const versions = this.templates.get(key);
    if (versions === undefined) {
      throw new AiPromptNotFoundException(key, version);
    }
    const template =
      version === undefined
        ? [...versions.values()].find((candidate) => candidate.active)
        : versions.get(version);
    if (template === undefined) {
      throw new AiPromptNotFoundException(key, version);
    }
    return template;
  }

  /** Render a template's body with the given variables. */
  render(key: string, variables: Record<string, unknown>, version?: number): string {
    const template = this.get(key, version);
    return renderTemplate(template.body, variables);
  }

  /** Preview a rendered template + its estimated token count. */
  preview(
    key: string,
    variables: Record<string, unknown>,
    version?: number,
  ): { key: string; version: number; rendered: string; estimatedTokens: number } {
    const template = this.get(key, version);
    const rendered = renderTemplate(template.body, variables);
    return {
      key: template.key,
      version: template.version,
      rendered,
      estimatedTokens: this.tokenCounter.estimateTokens(rendered),
    };
  }

  private put(template: ResolvedPrompt): void {
    const versions = this.templates.get(template.key) ?? new Map<number, ResolvedPrompt>();
    versions.set(template.version, template);
    this.templates.set(template.key, versions);
  }

  private async syncCatalog(): Promise<void> {
    for (const entry of AI_PROMPT_CATALOG) {
      const existing = await this.repo.findOne({ where: { key: entry.key, version: 1 } });
      if (existing !== null) {
        continue;
      }
      validateTemplateBody(entry.body, entry.variables);
      await this.repo.save(
        this.repo.create({
          key: entry.key,
          version: 1,
          category: entry.category,
          description: entry.description,
          body: entry.body,
          variables: entry.variables,
          active: true,
          updatedBy: null,
        }),
      );
    }
  }

  private async hydrateFromDb(): Promise<void> {
    const rows = await this.repo.find();
    if (rows.length === 0) {
      return;
    }
    this.templates.clear();
    for (const row of rows) {
      this.put({
        key: row.key,
        version: row.version,
        category: row.category,
        description: row.description,
        body: row.body,
        variables: row.variables,
        active: row.active,
        updatedAt: row.updatedAt,
      });
    }
  }
}
