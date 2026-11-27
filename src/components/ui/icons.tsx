import Svg, { Path } from 'react-native-svg';

type IconProps = {
  color: string;
  size?: number;
};

export function IconHome({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 10.6 12 4.5l7.5 6.1V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.2H10.2v5.2H6A1.5 1.5 0 0 1 4.5 19v-8.4Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconTrain({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
        stroke={color}
        strokeWidth={1.8}
      />
      <Path d="M12 7.5v4.2l2.8 1.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function IconDrill({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 3 6 13h5l-1 8 8-12h-5l0-6Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconBoard({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 4.5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"
        stroke={color}
        strokeWidth={1.8}
      />
      <Path d="M4.5 9.5h15M4.5 14.5h15M9.5 4.5v15M14.5 4.5v15" stroke={color} strokeWidth={1.4} />
    </Svg>
  );
}

export function IconProgress({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 19V11" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M12 19V6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M19 19v-5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function IconCheck({ color, size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5 9.2 17 19 7"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconX({ color, size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 7l10 10M17 7 7 17" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function IconInfo({ color, size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 11v6" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M12 7.5h.01" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

export function IconMenu({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 7h15M4.5 12h15M4.5 17h15" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

export function IconSliders({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path
        d="M16 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM10 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        stroke={color}
        strokeWidth={1.9}
      />
    </Svg>
  );
}

export function IconChevronDown({ color, size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m6 9 6 6 6-6" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconHelp({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
        stroke={color}
        strokeWidth={1.8}
      />
      <Path
        d="M9.6 9.5a2.5 2.5 0 0 1 4.7 1.1c0 1.6-2.3 2-2.3 3.4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path d="M12 17.2h.01" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function IconBookmark({ color, size = 16, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 4.5h11a1 1 0 0 1 1 1v14.8l-6.5-4.1-6.5 4.1V5.5a1 1 0 0 1 1-1Z"
        stroke={color}
        fill={filled ? color : 'none'}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

