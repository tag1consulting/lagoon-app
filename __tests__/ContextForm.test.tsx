import { fireEvent, render } from '@testing-library/react-native';

import { ContextForm } from '@/components/ContextForm';

describe('ContextForm', () => {
  it('derives Keycloak and UI URLs from the GraphQL URL', async () => {
    const { getByPlaceholderText, getByDisplayValue } = await render(
      <ContextForm submitLabel="Add" onSubmit={jest.fn()} />,
    );

    await fireEvent.changeText(
      getByPlaceholderText('https://api.example.com/graphql'),
      'https://api.sbs.example.com/graphql',
    );

    expect(getByDisplayValue('https://keycloak.sbs.example.com')).toBeTruthy();
    expect(getByDisplayValue('https://ui.sbs.example.com')).toBeTruthy();
  });

  it('rejects submission without a valid GraphQL URL', async () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByText } = await render(
      <ContextForm submitLabel="Add" onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(getByPlaceholderText('SBS'), 'SBS');
    await fireEvent.press(getByText('Add'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(getByText(/valid GraphQL URL/)).toBeTruthy();
  });

  it('submits a normalized context input', async () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByText } = await render(
      <ContextForm submitLabel="Add" onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(getByPlaceholderText('SBS'), 'SBS');
    await fireEvent.changeText(
      getByPlaceholderText('https://api.example.com/graphql'),
      'api.sbs.example.com',
    );
    await fireEvent.press(getByText('Add'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'SBS',
        graphqlUrl: 'https://api.sbs.example.com/graphql',
        keycloakBaseUrl: 'https://keycloak.sbs.example.com',
        keycloakRealm: 'lagoon',
        keycloakClientId: 'lagoon-ui',
        authMode: 'oidc',
      }),
    );
  });
});
