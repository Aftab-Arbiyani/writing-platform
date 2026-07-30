import { freshLogin } from '../../fixtures/auth';
import { test } from '../../fixtures/test';
import { NotificationsPage } from '../../pages/frontend/notifications-page';

/**
 * Frontend notifications (docs/e2e/06 Phase 3, `features/notifications`, m8 in-app poll).
 * Arranges the action via API — a throwaway 2nd user follows the seeded writer — then
 * asserts the writer's inbox surfaces the resulting notification.
 */
test.describe('@phase3 frontend notifications', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('a new follower produces a notification in the inbox', async ({ page, api, data }) => {
    const writerId = await api.writerId();
    const follower = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    const followerToken = await api.loginToken(follower.email, follower.password);
    await api.follow(writerId, followerToken); // follower → writer

    const notifications = new NotificationsPage(page);
    await notifications.goto();
    // Public writer → "started following you"; private → "requested to follow you".
    await notifications.expectNotification(/started following you|requested to follow you/i);
  });
});
