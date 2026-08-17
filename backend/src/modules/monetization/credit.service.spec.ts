import { CreditEntryType, CreditReason } from '@qalam/shared';
import type { DataSource, Repository } from 'typeorm';

import { CreditService } from './credit.service';
import type { CreditTransaction } from './entities/credit-transaction.entity';
import type { CreditWallet } from './entities/credit-wallet.entity';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeWallet(balance: number, lifetimeGranted = 100, lifetimeConsumed = 0) {
  return {
    id: 'wallet-1',
    userId: 'u1',
    balance,
    lifetimeGranted,
    lifetimeConsumed,
    createdAt: new Date(),
  };
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Builds the CreditService with a fake DataSource.transaction that calls the
 * callback with a controlled EntityManager. The manager's findOne returns
 * `walletInTx` (simulating a row lock); set to null to exercise the
 * "create-on-first-use" path.
 */
function build(opts?: {
  walletInTx?: ReturnType<typeof makeWallet> | null;
  walletForBalance?: ReturnType<typeof makeWallet> | null;
}) {
  const walletInTx = opts?.walletInTx !== undefined ? opts.walletInTx : makeWallet(100);

  const fakeManager = {
    findOne: jest.fn().mockResolvedValue(walletInTx),
    // Return the entity that was passed so callers can inspect mutations
    save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
    create: jest.fn().mockImplementation((_Entity: unknown, data: unknown) => ({
      ...(data as object),
    })),
  };

  const wallets = {
    findOne: jest.fn().mockResolvedValue(opts?.walletForBalance ?? null),
    create: jest.fn().mockImplementation((data: unknown) => ({ ...(data as object) })),
    save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
  } as unknown as Repository<CreditWallet>;

  const transactions = {
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
  } as unknown as Repository<CreditTransaction>;

  const dataSource = {
    transaction: jest
      .fn()
      .mockImplementation((cb: (mgr: typeof fakeManager) => Promise<unknown>) => cb(fakeManager)),
  } as unknown as DataSource;

  const service = new CreditService(wallets, transactions, dataSource);
  return { service, wallets, transactions, dataSource, fakeManager };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CreditService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('balance', () => {
    it('should return the wallet balance when a wallet exists', async () => {
      const { service } = build({ walletForBalance: makeWallet(500) });

      const result = await service.balance('u1');

      expect(result).toBe(500);
    });

    it('should return 0 when no wallet exists for the user', async () => {
      const { service } = build({ walletForBalance: null });

      const result = await service.balance('u1');

      expect(result).toBe(0);
    });
  });

  describe('findWallet', () => {
    it('should return the wallet when one exists', async () => {
      const wallet = makeWallet(250);
      const { service } = build({ walletForBalance: wallet });

      await expect(service.findWallet('u1')).resolves.toBe(wallet);
    });

    it('should return null WITHOUT creating a wallet when none exists', async () => {
      // The read-only counterpart to `getOrCreateWallet`, added for the admin balance read (B8,
      // A1-3). `getOrCreateWallet` inserts on a miss, which is right when a user opens their own
      // wallet screen and wrong when an operator merely looks at an account — a lookup must not
      // materialise a row, least of all for a mistyped id.
      const { service, wallets } = build({ walletForBalance: null });

      await expect(service.findWallet('u1')).resolves.toBeNull();
      expect(wallets.save).not.toHaveBeenCalled();
      expect(wallets.create).not.toHaveBeenCalled();
    });
  });

  describe('grant', () => {
    it('should increment balance and lifetimeGranted, then write a grant ledger row', async () => {
      const wallet = makeWallet(100, 50, 0); // balance=100, lifetime=50
      const { service, fakeManager } = build({ walletInTx: wallet });

      const newBalance = await service.grant({
        userId: 'u1',
        amount: 50,
        reason: CreditReason.SubscriptionGrant,
      });

      // Balance should be 100 + 50 = 150
      expect(newBalance).toBe(150);

      // First save call is the wallet
      const savedWallet = fakeManager.save.mock.calls[0]?.[0] as typeof wallet;
      expect(savedWallet.balance).toBe(150);
      expect(savedWallet.lifetimeGranted).toBe(100); // 50 + 50

      // Second create call builds the ledger row
      const [, txData] = fakeManager.create.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(txData.type).toBe(CreditEntryType.Grant);
      expect(txData.delta).toBe(50);
      expect(txData.balanceAfter).toBe(150);
      expect(txData.reason).toBe(CreditReason.SubscriptionGrant);
    });

    it('should create a new wallet when none exists and then grant credits', async () => {
      const { service, fakeManager } = build({ walletInTx: null }); // no wallet in TX

      // fakeManager.create returns the new wallet; fakeManager.save returns it
      // Simulate the wallet creation inline:
      const createdWallet = {
        id: undefined,
        userId: 'u1',
        balance: 0,
        lifetimeGranted: 0,
        lifetimeConsumed: 0,
      };
      fakeManager.create.mockImplementationOnce((_E: unknown, data: unknown) => ({
        ...(data as object),
      }));
      fakeManager.save.mockResolvedValueOnce({ ...createdWallet, id: 'new-wallet-1' });

      const newBalance = await service.grant({
        userId: 'u1',
        amount: 100,
        reason: CreditReason.Purchase,
      });

      // Since wallet starts at 0 and we grant 100:
      // new balance = Math.max(0, 0 + 100) = 100
      expect(newBalance).toBe(100);
    });
  });

  describe('debit', () => {
    it('should reduce balance and track lifetimeConsumed', async () => {
      const wallet = makeWallet(200, 200, 50);
      const { service, fakeManager } = build({ walletInTx: wallet });

      const newBalance = await service.debit({
        userId: 'u1',
        amount: 80,
        reason: CreditReason.AiUsage,
        tokens: 1000,
        costUsd: 0.01,
        feature: 'ai_writing',
      });

      expect(newBalance).toBe(120); // 200 - 80

      const savedWallet = fakeManager.save.mock.calls[0]?.[0] as typeof wallet;
      expect(savedWallet.balance).toBe(120);
      expect(savedWallet.lifetimeConsumed).toBe(130); // 50 + 80

      const [, txData] = fakeManager.create.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(txData.type).toBe(CreditEntryType.Debit);
      expect(txData.delta).toBe(-80); // negative delta for debit
      expect(txData.balanceAfter).toBe(120);
    });

    it('should clamp balance at 0 and record only the clamped delta when amount exceeds balance', async () => {
      const wallet = makeWallet(30, 30, 0);
      const { service, fakeManager } = build({ walletInTx: wallet });

      const newBalance = await service.debit({
        userId: 'u1',
        amount: 50, // exceeds the 30-credit balance
        reason: CreditReason.AiUsage,
      });

      // Balance cannot go below 0
      expect(newBalance).toBe(0);

      const savedWallet = fakeManager.save.mock.calls[0]?.[0] as typeof wallet;
      expect(savedWallet.balance).toBe(0);
      // Only 30 credits were actually consumed (clamped)
      expect(savedWallet.lifetimeConsumed).toBe(30);

      const [, txData] = fakeManager.create.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(txData.delta).toBe(-30); // clamped — not -50
      expect(txData.balanceAfter).toBe(0);
    });

    it('should be a no-op when balance is already 0', async () => {
      const wallet = makeWallet(0, 0, 0);
      const { service, fakeManager } = build({ walletInTx: wallet });

      const newBalance = await service.debit({
        userId: 'u1',
        amount: 50,
        reason: CreditReason.AiUsage,
      });

      expect(newBalance).toBe(0);

      const savedWallet = fakeManager.save.mock.calls[0]?.[0] as typeof wallet;
      expect(savedWallet.balance).toBe(0);
      // applied = 0 - 0 = 0, so lifetimeConsumed += 0
      expect(savedWallet.lifetimeConsumed).toBe(0);

      const [, txData] = fakeManager.create.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(txData.delta).toBe(0);
    });
  });

  describe('getOrCreateWallet', () => {
    it('should return the existing wallet when one already exists', async () => {
      const existing = makeWallet(250);
      const { service, wallets } = build();
      (wallets.findOne as jest.Mock).mockResolvedValue(existing);

      const result = await service.getOrCreateWallet('u1');

      expect(result).toBe(existing);
      expect(wallets.save).not.toHaveBeenCalled();
    });

    it('should create and save a new wallet when none exists', async () => {
      const { service, wallets } = build();
      (wallets.findOne as jest.Mock).mockResolvedValue(null);
      (wallets.create as jest.Mock).mockReturnValue({ userId: 'u1', balance: 0 });
      (wallets.save as jest.Mock).mockResolvedValue({ id: 'new-1', userId: 'u1', balance: 0 });

      const result = await service.getOrCreateWallet('u1');

      expect(wallets.save).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ userId: 'u1', balance: 0 });
    });
  });
});
