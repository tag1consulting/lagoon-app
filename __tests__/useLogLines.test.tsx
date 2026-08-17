import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useLogLines } from '@/components/LogViewer/useLogLines';

function Probe({ raw }: { raw: string }) {
  const { lines, parsing } = useLogLines(raw);
  return <Text testID="state">{parsing ? 'parsing' : `done:${lines.length}`}</Text>;
}

describe('useLogLines', () => {
  it('tokenizes a large log in chunks without losing lines', async () => {
    const bigLog = Array.from({ length: 50_000 }, (_, i) => `\x1b[32mline ${i}\x1b[0m`).join('\n');

    const { getByTestId } = await render(<Probe raw={bigLog} />);

    await waitFor(() => expect(getByTestId('state').children[0]).toBe('done:50000'), {
      timeout: 15_000,
    });
  }, 20_000);

  it('handles empty input', async () => {
    const { getByTestId } = await render(<Probe raw="" />);
    await waitFor(() => expect(getByTestId('state').children[0]).toBe('done:0'));
  });
});
