// In-memory stand-in for the parts of Prisma the auth code uses.
type Attempt = { key: string; createdAt: Date };
type User = {
  id: string;
  name: string | null;
  email: string;
  passwordHash: string | null;
  image: string | null;
};

export function createFakeDb() {
  const attempts: Attempt[] = [];
  const users: User[] = [];
  const matches = (a: Attempt, where: { key?: string; createdAt?: { gte?: Date; lt?: Date } }) =>
    (where.key === undefined || a.key === where.key) &&
    (!where.createdAt?.gte || a.createdAt >= where.createdAt.gte) &&
    (!where.createdAt?.lt || a.createdAt < where.createdAt.lt);

  const db = {
    loginAttempt: {
      count: async ({ where }: { where: Parameters<typeof matches>[1] }) =>
        attempts.filter((a) => matches(a, where)).length,
      createMany: async ({ data }: { data: { key: string }[] }) => {
        data.forEach(({ key }) => attempts.push({ key, createdAt: new Date() }));
      },
      deleteMany: async ({ where }: { where: Parameters<typeof matches>[1] }) => {
        for (let i = attempts.length - 1; i >= 0; i--)
          if (matches(attempts[i], where)) attempts.splice(i, 1);
      },
    },
    user: {
      findUnique: async ({ where }: { where: { email: string } }) =>
        users.find((u) => u.email === where.email) ?? null,
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };

  return { db, attempts, users };
}
