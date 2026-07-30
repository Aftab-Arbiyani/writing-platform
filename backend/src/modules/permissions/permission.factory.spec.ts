import { PermissionFactory } from './permission.factory';

describe('PermissionFactory (wildcard matching)', () => {
  const factory = new PermissionFactory();

  it('matches an exact permission', () => {
    expect(factory.satisfies(new Set(['piece.publish']), 'piece.publish')).toBe(true);
  });

  it('denies when the permission is absent', () => {
    expect(factory.satisfies(new Set(['piece.create']), 'piece.publish')).toBe(false);
    expect(factory.satisfies(new Set(), 'piece.publish')).toBe(false);
  });

  it('matches a module wildcard', () => {
    const granted = new Set(['piece.*']);
    expect(factory.satisfies(granted, 'piece.publish')).toBe(true);
    expect(factory.satisfies(granted, 'piece.delete')).toBe(true);
    expect(factory.satisfies(granted, 'comment.delete')).toBe(false);
  });

  it('matches the global wildcard (super admin)', () => {
    const granted = new Set(['*']);
    expect(factory.satisfies(granted, 'anything.at.all')).toBe(true);
    expect(factory.satisfies(granted, 'system.manage')).toBe(true);
  });

  it('matches deeper namespaces via a higher-level wildcard', () => {
    expect(factory.satisfies(new Set(['a.*']), 'a.b.c')).toBe(true);
    expect(factory.satisfies(new Set(['a.b.*']), 'a.b.c')).toBe(true);
    expect(factory.satisfies(new Set(['a.b.*']), 'a.c')).toBe(false);
  });

  it('satisfiesAll requires every permission (AND)', () => {
    const granted = new Set(['report.review', 'comment.delete']);
    expect(factory.satisfiesAll(granted, ['report.review', 'comment.delete'])).toBe(true);
    expect(factory.satisfiesAll(granted, ['report.review', 'report.resolve'])).toBe(false);
  });

  it('missing returns the unsatisfied subset', () => {
    const granted = new Set(['piece.*']);
    expect(factory.missing(granted, ['piece.publish', 'user.suspend'])).toEqual(['user.suspend']);
    expect(factory.missing(granted, ['piece.publish'])).toEqual([]);
  });
});
