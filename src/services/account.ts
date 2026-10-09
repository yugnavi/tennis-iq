/**
 * Optional Google account on top of the anonymous identity. Linking keeps the same
 * auth.uid(), so every row guarded by RLS (XP, TIQ, attempts) carries over unchanged.
 * Requires the Google provider and manual identity linking enabled in Supabase Auth.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, AccountService } from '../types';

export const OAUTH_RETURN_PATH = '/progress';

export function createAccountService(
  client: SupabaseClient,
  redirectTo: () => string = () => `${window.location.origin}${OAUTH_RETURN_PATH}`,
): AccountService {
  return {
    async getAccount(): Promise<Account> {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      const google = user?.identities?.find((i) => i.provider === 'google');
      if (!user || user.is_anonymous || !google) return { kind: 'guest' };
      const meta = google.identity_data ?? {};
      return {
        kind: 'google',
        email: user.email ?? (meta.email as string | undefined),
        name: (meta.full_name as string | undefined) ?? (meta.name as string | undefined),
      };
    },

    async signInWithGoogle({ switchAccount = false } = {}) {
      const { data } = await client.auth.getSession();
      const isGuest = !data.session || data.session.user.is_anonymous;
      const options = { redirectTo: redirectTo() };
      const { error } =
        isGuest && !switchAccount
          ? await client.auth.linkIdentity({ provider: 'google', options })
          : await client.auth.signInWithOAuth({ provider: 'google', options });
      if (error) throw error;
    },

    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
  };
}

/** Reads an OAuth error the auth server appended to the return URL (query or hash). */
export function readOAuthError(href: string): { code?: string; message: string } | null {
  const url = new URL(href);
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  url.searchParams.forEach((v, k) => params.set(k, v));
  if (!params.get('error') && !params.get('error_code')) return null;
  return {
    code: params.get('error_code') ?? undefined,
    message: params.get('error_description') ?? 'Google sign-in did not complete.',
  };
}
