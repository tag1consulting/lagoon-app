import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { getDefaultRedirectUri } from '@/auth/pkce';
import { Button, Field } from '@/components/ui';
import type { LagoonContext, LagoonContextInput } from '@/contexts/types';
import { DEFAULT_KEYCLOAK_CLIENT_ID, DEFAULT_KEYCLOAK_REALM } from '@/contexts/types';
import { deriveUrls, normalizeGraphqlUrl } from '@/contexts/urlDerivation';
import { spacing, useTheme } from '@/theme';

export function ContextForm({
  initial,
  submitLabel,
  onSubmit,
  onDelete,
}: {
  initial?: LagoonContext;
  submitLabel: string;
  onSubmit: (input: LagoonContextInput) => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [graphqlUrl, setGraphqlUrl] = useState(initial?.graphqlUrl ?? '');
  const [keycloakBaseUrl, setKeycloakBaseUrl] = useState(initial?.keycloakBaseUrl ?? '');
  const [keycloakClientId, setKeycloakClientId] = useState(
    initial?.keycloakClientId ?? DEFAULT_KEYCLOAK_CLIENT_ID,
  );
  const [uiUrl, setUiUrl] = useState(initial?.uiUrl ?? '');
  const [redirectUri, setRedirectUri] = useState(initial?.redirectUri ?? '');
  const [useStaticToken, setUseStaticToken] = useState(initial?.authMode === 'static-token');
  // Track whether the user has hand-edited derived fields so typing in the
  // GraphQL field keeps proposing values until they take over.
  const [keycloakTouched, setKeycloakTouched] = useState(Boolean(initial));
  const [uiTouched, setUiTouched] = useState(Boolean(initial));
  const [error, setError] = useState<string | null>(null);

  const handleGraphqlChange = (value: string) => {
    setGraphqlUrl(value);
    const normalized = normalizeGraphqlUrl(value);
    if (!normalized) return;
    const derived = deriveUrls(normalized);
    if (!derived) return;
    if (!keycloakTouched) setKeycloakBaseUrl(derived.keycloakBaseUrl);
    if (!uiTouched) setUiUrl(derived.uiUrl);
  };

  const handleSubmit = () => {
    const normalized = normalizeGraphqlUrl(graphqlUrl);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!normalized) {
      setError('Enter a valid GraphQL URL, e.g. https://api.example.com/graphql');
      return;
    }
    if (!useStaticToken && !/^https?:\/\/.+\..+/.test(keycloakBaseUrl.trim())) {
      setError('Enter a valid Keycloak URL, e.g. https://keycloak.example.com');
      return;
    }
    setError(null);
    onSubmit({
      name: name.trim(),
      graphqlUrl: normalized,
      keycloakBaseUrl: keycloakBaseUrl.trim().replace(/\/+$/, ''),
      keycloakRealm: initial?.keycloakRealm ?? DEFAULT_KEYCLOAK_REALM,
      keycloakClientId: keycloakClientId.trim() || DEFAULT_KEYCLOAK_CLIENT_ID,
      uiUrl: uiUrl.trim() ? uiUrl.trim().replace(/\/+$/, '') : undefined,
      redirectUri: redirectUri.trim() || undefined,
      authMode: useStaticToken ? 'static-token' : 'oidc',
    });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Field
        label="Name"
        placeholder="SBS"
        value={name}
        onChangeText={setName}
        autoFocus={!initial}
      />
      <Field
        label="GraphQL API URL"
        placeholder="https://api.example.com/graphql"
        keyboardType="url"
        value={graphqlUrl}
        onChangeText={handleGraphqlChange}
      />
      <Field
        label="Keycloak URL"
        placeholder="https://keycloak.example.com"
        hint="Derived from the API URL — edit if your install differs."
        keyboardType="url"
        value={keycloakBaseUrl}
        onChangeText={(v) => {
          setKeycloakTouched(true);
          setKeycloakBaseUrl(v);
        }}
      />
      <Field
        label="Keycloak client ID"
        placeholder={DEFAULT_KEYCLOAK_CLIENT_ID}
        hint="Public client used for login. Change if your admin created a dedicated mobile client."
        value={keycloakClientId}
        onChangeText={setKeycloakClientId}
      />
      <Field
        label="Redirect URI (optional)"
        placeholder={getDefaultRedirectUri()}
        hint={`Leave blank to use ${getDefaultRedirectUri()}. Must match a Valid Redirect URI on the Keycloak client exactly.`}
        value={redirectUri}
        onChangeText={setRedirectUri}
      />
      <Field
        label="Web UI URL (optional)"
        placeholder="https://ui.example.com"
        keyboardType="url"
        value={uiUrl}
        onChangeText={(v) => {
          setUiTouched(true);
          setUiUrl(v);
        }}
      />

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '600' }}>Use a pasted token</Text>
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>
            Skip browser login and paste an API token instead (e.g. from `lagoon get token`).
          </Text>
        </View>
        <Switch value={useStaticToken} onValueChange={setUseStaticToken} />
      </View>

      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}

      <Button title={submitLabel} onPress={handleSubmit} />
      {onDelete ? <Button title="Delete context" variant="danger" onPress={onDelete} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    padding: spacing.md,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
});
