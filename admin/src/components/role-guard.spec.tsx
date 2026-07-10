import { Role } from '@qalam/shared';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PermissionGuard } from '@/components/permission-guard';
import { RoleGuard } from '@/components/role-guard';
import { useAuthStore } from '@/stores/auth.store';

afterEach(() => useAuthStore.getState().clear());

describe('RoleGuard', () => {
  it('renders children when the role meets the floor', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Admin });
    render(
      <RoleGuard min={Role.Moderator}>
        <span>content</span>
      </RoleGuard>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders the fallback when the role is below the floor', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Moderator });
    render(
      <RoleGuard min={Role.Admin} fallback={<span>denied</span>}>
        <span>content</span>
      </RoleGuard>,
    );
    expect(screen.getByText('denied')).toBeInTheDocument();
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });
});

describe('PermissionGuard', () => {
  it('renders children when the permission is granted (wildcard)', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.SuperAdmin });
    render(
      <PermissionGuard require="user.suspend">
        <span>act</span>
      </PermissionGuard>,
    );
    expect(screen.getByText('act')).toBeInTheDocument();
  });

  it('renders the fallback when the permission is missing', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Moderator });
    render(
      <PermissionGuard require="role.assign" fallback={<span>no</span>}>
        <span>act</span>
      </PermissionGuard>,
    );
    expect(screen.getByText('no')).toBeInTheDocument();
    expect(screen.queryByText('act')).not.toBeInTheDocument();
  });
});
