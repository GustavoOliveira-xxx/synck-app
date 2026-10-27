import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

import { ICON_NAMES, type IconName } from './iconNames';
import icons from './icons.generated.json';

export type { IconName } from './iconNames';

/** Desenhos locais, renderizados nativamente no Android e como SVG na web. */
export const SvgArtwork = memo(function SvgArtwork({
  name,
  size = 24,
  color,
  strokeWidth = 1.75,
}: {
  name: keyof typeof icons;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const artwork = icons[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={artwork.viewBox}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      focusable={false}
    >
      {artwork.paths.map((part, index) => (
        <Path
          key={index}
          d={part.d}
          fill={part.fill === 'currentColor' ? color : part.fill}
          stroke={part.stroke === 'currentColor' ? color : part.stroke}
        />
      ))}
    </Svg>
  );
});

/** O rótulo acessível fica no controle que contém o ícone. */
export const Icon = memo(function Icon({
  name,
  ...props
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return <SvgArtwork name={ICON_NAMES[name]} {...props} />;
});
