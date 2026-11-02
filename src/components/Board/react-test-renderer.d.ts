declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export type ReactTestRenderer = {
    update(next: ReactElement): void;
    unmount(): void;
  };

  export function act(callback: () => void): void;
  export function create(element: ReactElement): ReactTestRenderer;
}
