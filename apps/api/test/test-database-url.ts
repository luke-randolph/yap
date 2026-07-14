// The tests run against a real throwaway Postgres database, kept separate from
// the dev database. CI sets TEST_DATABASE_URL to its service container.
export function testDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? 'postgresql://yap:yap@localhost:5432/yap_test';
}
