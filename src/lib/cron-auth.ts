export function verifyCronAuth(
  headers: Headers,
  cronSecret: string | undefined,
): boolean {
  if (!cronSecret) {
    return false;
  }

  const authorization = headers.get("authorization");
  if (authorization === `Bearer ${cronSecret}`) {
    return true;
  }

  return headers.get("x-cron-secret") === cronSecret;
}
