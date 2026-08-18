import { fireEvent, render } from '@testing-library/react-native';

import { ContextForm } from '@/components/ContextForm';

describe('ContextForm', () => {
  it('derives Keycloak and UI URLs from the GraphQL URL', async () => {
    const { getByPlaceholderText, getByDisplayValue } = await render(
      <ContextForm submitLabel="Add" onSubmit={jest.fn()} />,
    );

    await fireEvent.changeText(
      getByPlaceholderText('https://api.example.com/graphql'),
      'https://api.acme.example.com/graphql',
    );

    expect(getByDisplayValue('https://keycloak.acme.example.com')).toBeTruthy();
    expect(getByDisplayValue('https://ui.acme.example.com')).toBeTruthy();
  });

  it('rejects submission without a valid GraphQL URL', async () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByText } = await render(
      <ContextForm submitLabel="Add" onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(getByPlaceholderText('Acme'), 'Acme');
    await fireEvent.press(getByText('Add'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(getByText(/valid GraphQL URL/)).toBeTruthy();
  });

  it('submits a normalized context input', async () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByText } = await render(
      <ContextForm submitLabel="Add" onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(getByPlaceholderText('Acme'), 'Acme');
    await fireEvent.changeText(
      getByPlaceholderText('https://api.example.com/graphql'),
      'api.acme.example.com',
    );
    await fireEvent.press(getByText('Add'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Acme',
        graphqlUrl: 'https://api.acme.example.com/graphql',
        keycloakBaseUrl: 'https://keycloak.acme.example.com',
        keycloakRealm: 'lagoon',
        keycloakClientId: 'lagoon-ui',
        authMode: 'oidc',
      }),
    );
  });
});
