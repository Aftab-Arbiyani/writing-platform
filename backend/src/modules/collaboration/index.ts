/**
 * Public surface of the collaboration module (AF6 — docs 16 §5.2, one barrel per
 * module). Feature modules never reach into internals; they consume the module
 * and, where needed, the exported `MembershipService` (the Policy Engine's story
 * membership source).
 */
export { CollaborationModule } from './collaboration.module';
export { MembershipService } from './membership.service';
