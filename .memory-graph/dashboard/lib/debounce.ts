export interface Debounced {
  (): void;
  cancel(): void;
}

export function debounce(fn: () => void, ms: number): Debounced {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const debounced = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn();
      timeoutId = undefined;
    }, ms);
  };

  debounced.cancel = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  return debounced;
}
