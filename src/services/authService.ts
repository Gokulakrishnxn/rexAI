/**
 * Auth: sign in, sign up, token refresh.
 */

export async function signIn(email: string, password: string): Promise<{ token: string }> {
  // TODO: integrate with your auth backend
  return { token: 'stub' };
}

export async function signUp(email: string, password: string): Promise<void> {
  // TODO
}

export async function refreshToken(): Promise<string> {
  return 'stub';
}
