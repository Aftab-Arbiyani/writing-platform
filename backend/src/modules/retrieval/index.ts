/**
 * Public surface of the Retrieval Platform (AF4). Feature modules import the reusable
 * pipeline entry point + evaluation from here (docs 16 §5.2 — one barrel per module).
 */
export { RetrievalModule } from './retrieval.module';
export { RetrievalService } from './retrieval.service';
export { SearchEvaluationService } from './evaluation/search-evaluation.service';
