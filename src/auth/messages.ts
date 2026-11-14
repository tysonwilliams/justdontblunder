/** Calm copy for Auth errors. Raw provider text stays out of the screen. */
export function authErrorMessage(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login') || text.includes('invalid credentials')) {
    return "That email and password don't match.";
  }
  if (text.includes('already registered') || text.includes('already been registered')) {
    return 'That email already has an account. Sign in instead.';
  }
  if (text.includes('email not confirmed')) {
    return 'Confirm that email first. The link is in your inbox.';
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return 'Wait a minute, then try again.';
  }
  if (text.includes('password') && (text.includes('short') || text.includes('at least') || text.includes('weak'))) {
    return 'Use at least 6 characters.';
  }
  return "That didn't work. Try again.";
}

export function providerUnavailable(message: string): boolean {
  const text = message.toLowerCase();
  return text.includes('not enabled') || text.includes('unsupported provider');
}

export function oauthUnavailableMessage(provider: 'google' | 'apple'): string {
  switch (provider) {
    case 'google':
      return "Google sign-in isn't turned on yet. Use email instead.";
    case 'apple':
      return "Apple sign-in isn't turned on yet. Use email instead.";
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

export function oauthFailedMessage(): string {
  return "That sign-in didn't finish. Try again, or use email.";
}
