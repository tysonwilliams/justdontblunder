(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => new Map<string, string>());
const loadLeaderboardPage = vi.hoisted(() => vi.fn());
const saveLeaderboardName = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: async (key: string) => {
      memory.delete(key);
    },
  },
}));

vi.mock('react-native', () => {
  const React = require('react') as typeof import('react');
  const host = (type: string) =>
    function Host(props: { children?: ReactNode }) {
      return React.createElement(type, props, props.children);
    };
  return {
    Pressable: host('pressable'),
    View: host('view'),
    Text: host('text'),
    TextInput: host('textinput'),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      flatten: (style: unknown) => style,
    },
    Platform: { OS: 'web', select: (options: { web?: unknown; default?: unknown }) => options.web ?? options.default },
    useColorScheme: () => 'dark',
    Appearance: {
      getColorScheme: () => 'dark',
      addChangeListener: () => ({ remove: () => undefined }),
    },
  };
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
  useLayout: () => ({ phone: false }),
}));

vi.mock('@/src/components/ui/Skeleton', () => {
  const React = require('react') as typeof import('react');
  return { Bone: () => React.createElement('bone') };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/src/data/leaderboard', () => ({
  loadLeaderboardPage,
  saveLeaderboardName,
}));

import { StreakLeaderboard, StreakLeaderboardView } from '@/src/components/progress/StreakLeaderboard';
import { useAccountStore } from '@/src/auth/session';
import { useProgressStore } from '@/src/store/progress';

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
    .join('');
}

function callProp(renderer: ReactTestRenderer, testID: string, prop: string, value?: string) {
  const node = renderer.root.findByProps({ testID });
  const handler = node.props[prop];
  if (typeof handler !== 'function') throw new Error(`missing ${prop} on ${testID}`);
  (handler as (next?: string) => void)(value);
}

async function unmount(renderer: ReactTestRenderer) {
  await act(async () => {
    renderer.unmount();
  });
}

const row = (displayName: string, score: number) => ({ displayName, score });

describe('streak leaderboard', () => {
  beforeEach(async () => {
    loadLeaderboardPage.mockReset();
    saveLeaderboardName.mockReset();
    push.mockReset();
    loadLeaderboardPage.mockReturnValue(new Promise(() => undefined));
    saveLeaderboardName.mockResolvedValue({ ok: true });
    useAccountStore.setState({ phase: 'guest', configured: false, user: null });
    await act(async () => {
      await useProgressStore.persist.rehydrate();
      useProgressStore.setState({ bestPuzzleStreak: 4 });
    });
  });

  it('keeps the switch off, hides the account address, and does not save a blocked name', async () => {
    useAccountStore.setState({
      phase: 'signed-in',
      configured: true,
      user: { id: 'user-1', email: 'secret@example.com', label: 'secret@example.com' },
    });
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(<StreakLeaderboard />);
    });
    expect(visibleText(renderer!)).not.toContain('secret@example.com');
    const optIn = renderer!.root.findAll((node) => node.props?.testID === 'leaderboard-opt-in');
    expect(optIn.some((node) => node.props.value === false)).toBe(true);
    expect(optIn.some((node) => node.props['aria-checked'] === false)).toBe(true);
    expect(visibleText(renderer!)).toContain('Best on this device: 4');

    await act(async () => {
      callProp(renderer!, 'leaderboard-name', 'onChangeText', 'shit');
    });
    await act(async () => {
      callProp(renderer!, 'leaderboard-save', 'onPress');
    });
    expect(saveLeaderboardName).not.toHaveBeenCalled();
    expect(visibleText(renderer!)).toContain('Choose a different name.');

    await act(async () => {
      callProp(renderer!, 'leaderboard-name', 'onChangeText', 'Ada');
    });
    await act(async () => {
      callProp(renderer!, 'leaderboard-save', 'onPress');
    });
    expect(saveLeaderboardName).toHaveBeenCalledWith('Ada', false);

    await act(async () => {
      callProp(renderer!, 'leaderboard-play', 'onPress');
    });
    expect(push).toHaveBeenCalledWith('/drills?streak=1');
    await unmount(renderer!);
  });

  it('lets a guest play and explains that the board is a chosen name', async () => {
    useAccountStore.setState({
      phase: 'guest',
      configured: true,
      user: { id: 'left-over', email: 'secret@example.com', label: 'secret@example.com' },
    });
    let resolvePage: (page: unknown) => void = () => undefined;
    loadLeaderboardPage.mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(<StreakLeaderboard />);
    });
    await act(async () => {
      resolvePage({
        configured: true,
        week: [row('Ada', 4)],
        allTime: [row('Ada', 9)],
        name: '',
        optedIn: false,
        unavailable: false,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const text = visibleText(renderer!);
    expect(text).toContain('It does not show your email.');
    expect(text).toContain('Play stays open without an account.');
    expect(text).toContain('Ada');
    expect(text).not.toContain('secret@example.com');
    expect(renderer!.root.findAllByProps({ testID: 'leaderboard-name' })).toHaveLength(0);
    await act(async () => {
      callProp(renderer!, 'leaderboard-play', 'onPress');
    });
    expect(push).toHaveBeenCalledWith('/drills?streak=1');
    await unmount(renderer!);
  });

  it('renders the public rows and the empty, missing, and failed boards', async () => {
    const shared = {
      best: 2,
      signedIn: false,
      loading: false,
      name: '',
      optedIn: false,
      notice: null,
      saving: false,
      onName: () => undefined,
      onOptIn: () => undefined,
      onSave: () => undefined,
      onPlay: () => undefined,
    };
    let listed: ReactTestRenderer;
    await act(async () => {
      listed = create(
        <StreakLeaderboardView
          {...shared}
          configured
          unavailable={false}
          week={[row('Ada', 4), row('secret@example.com', 9)]}
          allTime={[]}
        />,
      );
    });
    const listedText = visibleText(listed!);
    expect(listedText).toContain('This week');
    expect(listedText).toContain('Resets Monday at 00:00 UTC');
    expect(listedText).toContain('All-time best');
    expect(listedText).toContain('Ada');
    expect(listedText).not.toContain('secret@example.com');
    expect(listedText).toContain('No public scores yet.');
    expect(listed!.root.findAllByProps({ testID: 'leaderboard-opt-in' })).toHaveLength(0);
    await unmount(listed!);

    let quiet: ReactTestRenderer;
    await act(async () => {
      quiet = create(
        <StreakLeaderboardView {...shared} configured={false} unavailable={false} week={[]} allTime={[]} />,
      );
    });
    const quietText = visibleText(quiet!);
    expect(quietText).toContain('This build has no leaderboard server. Your best stays on this device.');
    expect(quietText).not.toContain('No public scores yet.');
    await unmount(quiet!);

    let down: ReactTestRenderer;
    await act(async () => {
      down = create(<StreakLeaderboardView {...shared} configured unavailable week={[]} allTime={[]} />);
    });
    expect(visibleText(down!)).toContain('The public board is not available right now. Your best stays on this device.');
    await unmount(down!);
  });
});
