(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => {
  const React = require('react') as typeof import('react');
  const host = (type: string) =>
    function Host(props: { children?: ReactNode; visible?: boolean }) {
      if (type === 'modal' && props.visible === false) return null;
      return React.createElement(type, props, props.children);
    };
  return {
    Modal: host('modal'),
    Pressable: host('pressable'),
    ScrollView: host('scrollview'),
    View: host('view'),
    Text: host('text'),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      flatten: (style: unknown) => style,
      absoluteFill: {},
    },
    Platform: { OS: 'web', select: (options: { web?: unknown; default?: unknown }) => options.web ?? options.default },
    useColorScheme: () => 'dark',
    Appearance: {
      getColorScheme: () => 'dark',
      addChangeListener: () => ({ remove: () => undefined }),
    },
  };
});

vi.mock('react-native-svg', () => {
  const React = require('react') as typeof import('react');
  const host = (type: string) =>
    function Host(props: { children?: ReactNode }) {
      return React.createElement(type, props, props.children);
    };
  return { default: host('svg'), Path: host('path') };
});

vi.mock('@/src/theme/useTheme', async () => {
  const { themeFor } = await import('@/src/theme/tokens');
  const { setActivePalette } = await import('@/src/theme/active');
  return {
    useTheme: () => {
      const theme = themeFor('dark');
      setActivePalette(theme.colors);
      return theme;
    },
  };
});

vi.mock('@/src/components/ui/useLayout', () => ({
  useLayout: () => ({ phone: true }),
}));

vi.mock('@/src/components/ui/screenInsets', () => ({
  useScreenInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('@/src/components/SettingsMenu', () => {
  const React = require('react') as typeof import('react');
  return {
    MenuButton: () => React.createElement('menu-button'),
  };
});

import { DrillToolbar } from '@/src/components/DrillToolbar';

function flatten(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flatten).join('');
  return '';
}

function visibleText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAllByType('text')
    .map((node) => flatten(node.props.children))
    .join(' ');
}

function pressablesByTestId(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.findAllByType('pressable').filter((node) => node.props.testID === testID);
}

function viewsByTestId(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.findAllByType('view').filter((node) => node.props.testID === testID);
}

function press(renderer: ReactTestRenderer, testID: string) {
  const node = pressablesByTestId(renderer, testID)[0];
  if (!node) throw new Error(`missing pressable ${testID}`);
  const handler = node.props.onPress;
  if (typeof handler !== 'function') throw new Error(`missing onPress on ${testID}`);
  (handler as () => void)();
}

describe('DrillToolbar', () => {
  it('collapses mode and themes behind one trigger while keeping Streak toggle accessible on Play', async () => {
    const onMode = vi.fn();
    const onTheme = vi.fn();
    const onStreak = vi.fn();

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <DrillToolbar mode="play" theme="all" streak={false} onMode={onMode} onTheme={onTheme} onStreak={onStreak} />,
      );
    });

    expect(pressablesByTestId(renderer!, 'drill-options-trigger')).toHaveLength(1);
    expect(pressablesByTestId(renderer!, 'streak-toggle')).toHaveLength(1);
    expect(viewsByTestId(renderer!, 'drill-options-sheet')).toHaveLength(0);

    await act(async () => {
      press(renderer!, 'drill-options-trigger');
    });

    const text = visibleText(renderer!);
    expect(text).toContain('Hanging');
    expect(text).toContain('Back rank');
    expect(text).toContain('Mate');

    await act(async () => {
      press(renderer!, 'drill-theme-fork');
      press(renderer!, 'drill-mode-pick');
    });

    expect(onTheme).toHaveBeenCalledWith('fork');
    expect(onMode).toHaveBeenCalledWith('pick');

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('shows active theme in the compact trigger label and hides Streak on Pick', async () => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <DrillToolbar mode="pick" theme="fork" streak={false} onMode={vi.fn()} onTheme={vi.fn()} onStreak={vi.fn()} />,
      );
    });

    expect(visibleText(renderer!)).toContain('Pick · Fork');
    expect(pressablesByTestId(renderer!, 'streak-toggle')).toHaveLength(0);

    await act(async () => {
      renderer!.unmount();
    });
  });
});
