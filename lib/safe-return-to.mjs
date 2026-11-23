export function safeReturnTo(value, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || value.includes('\\')) {
    return fallback;
  }
  try {
    const resolved = new URL(value, 'https://return-to.invalid');
    return resolved.origin === 'https://return-to.invalid' ? value : fallback;
  } catch {
    return fallback;
  }
}
