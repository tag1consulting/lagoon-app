import * as SecureStore from 'expo-secure-store';

/**
 * Per-context token persistence. One SecureStore key per context — values
 * must stay small (SecureStore warns above ~2KB), so refresh tokens and
 * static tokens are stored individually, never as one serialized blob.
 */

const refreshKey = (contextId: string) => `lagoon.refresh.${contextId}`;
const staticKey = (contextId: string) => `lagoon.static.${contextId}`;

export async function saveRefreshToken(contextId: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(refreshKey(contextId), token);
}

export async function loadRefreshToken(contextId: string): Promise<string | null> {
  return SecureStore.getItemAsync(refreshKey(contextId));
}

export async function saveStaticToken(contextId: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(staticKey(contextId), token);
}

export async function loadStaticToken(contextId: string): Promise<string | null> {
  return SecureStore.getItemAsync(staticKey(contextId));
}

export async function clearTokens(contextId: string): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(refreshKey(contextId)),
    SecureStore.deleteItemAsync(staticKey(contextId)),
  ]);
}
