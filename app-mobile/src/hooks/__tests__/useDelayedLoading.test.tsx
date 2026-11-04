import { act, renderHook } from '@testing-library/react-native';
import { useDelayedLoading } from '../useDelayedLoading';
afterEach(() => jest.useRealTimers());
test('esperas curtas não piscam e cada espera longa ganha seu próprio indicador', async () => {
  jest.useFakeTimers();
  const { result, rerender, unmount } = await renderHook(
    ({ active }: { active: boolean }) => useDelayedLoading(active),
    { initialProps: { active: true } },
  );
  expect(result.current).toBe(false);
  await act(() => jest.advanceTimersByTime(100));
  await rerender({ active: false });
  await act(() => jest.advanceTimersByTime(500));
  expect(result.current).toBe(false);
  await rerender({ active: true });
  expect(result.current).toBe(false);
  await act(() => jest.advanceTimersByTime(250));
  expect(result.current).toBe(true);
  await rerender({ active: false });
  expect(result.current).toBe(false);
  await rerender({ active: true });
  expect(result.current).toBe(false);
  await unmount();
  await act(() => jest.advanceTimersByTime(1000));
});
