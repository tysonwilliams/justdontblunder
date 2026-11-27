declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export type ReactTestInstance = {
    props: { [propName: string]: unknown };
    findAll(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[];
    findAllByType(type: string): ReactTestInstance[];
    findAllByProps(props: { [propName: string]: unknown }): ReactTestInstance[];
    findByProps(props: { [propName: string]: unknown }): ReactTestInstance;
  };

  export type ReactTestRenderer = {
    root: ReactTestInstance;
    update(next: ReactElement): void;
    unmount(): void;
  };

  export function act(callback: () => void): void;
  export function create(element: ReactElement): ReactTestRenderer;
}
