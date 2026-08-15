import { render } from '@testing-library/react-native';

import Index from '../app/index';

describe('app scaffold', () => {
  it('renders the landing screen', async () => {
    const { getByText } = await render(<Index />);
    expect(getByText('Lagoon Mobile')).toBeTruthy();
  });
});
