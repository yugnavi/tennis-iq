import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createAccountService, readOAuthError } from '../../services/account';

function client(user: Record<string, unknown> | null) {
  const auth = {
    getSession: async () => ({ data: { session: user ? { user } : null }, error: null }),
    linkIdentity: vi.fn(async () => ({ data: {}, error: null })),
    signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  return { auth, client: { auth } as unknown as SupabaseClient };
}

const guest = { is_anonymous: true, identities: [] };
const googleUser = {
  is_anonymous: false,
  email: 'p@example.com',
  identities: [{ provider: 'google', identity_data: { full_name: 'Pat' } }],
};
const redirect = () => 'https://app.test/progress';

describe('account service', () => {
  it('reports guests and Google users', async () => {
    await expect(createAccountService(client(guest).client, redirect).getAccount()).resolves.toEqual({ kind: 'guest' });
    await expect(createAccountService(client(googleUser).client, redirect).getAccount()).resolves.toEqual({
      kind: 'google',
      email: 'p@example.com',
      name: 'Pat',
    });
  });

  it('links Google to the anonymous identity so progress is kept', async () => {
    const c = client(guest);
    await createAccountService(c.client, redirect).signInWithGoogle();
    expect(c.auth.linkIdentity).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'https://app.test/progress' } });
    expect(c.auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('signs into an existing Google account when switching', async () => {
    const c = client(guest);
    await createAccountService(c.client, redirect).signInWithGoogle({ switchAccount: true });
    expect(c.auth.signInWithOAuth).toHaveBeenCalled();
    expect(c.auth.linkIdentity).not.toHaveBeenCalled();
  });

  it('surfaces auth errors', async () => {
    const c = client(guest);
    c.auth.linkIdentity.mockResolvedValueOnce({ data: {}, error: new Error('Manual linking is disabled') } as never);
    await expect(createAccountService(c.client, redirect).signInWithGoogle()).rejects.toThrow('Manual linking');
  });
});

describe('readOAuthError', () => {
  it('reads errors from the query or hash', () => {
    expect(readOAuthError('https://a.test/progress')).toBeNull();
    expect(readOAuthError('https://a.test/progress?error=x&error_code=identity_already_exists')?.code).toBe('identity_already_exists');
    expect(readOAuthError('https://a.test/progress#error=x&error_description=Nope')?.message).toBe('Nope');
  });
});
