import { DependencyList, useEffect } from 'react';

export function useDebouncedEffect(effect: () => void | (() => void), delayMs: number, deps: DependencyList): void {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      effect();
    }, delayMs);

    return () => {
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
