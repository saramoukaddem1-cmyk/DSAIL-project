/** Max wait for `auth.getUser()` so middleware / layouts never hang indefinitely. */
export const SUPABASE_GET_USER_TIMEOUT_MS = 12_000;

/** Sign-in can be slower than `getUser()` due to network + auth overhead. */
export const SUPABASE_SIGN_IN_TIMEOUT_MS = 25_000;
