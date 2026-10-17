'use client';

import { Cube, Waves, CirclesThree } from '@phosphor-icons/react';

export type LogoVariant = 'polyhedron' | 'lunar-wave' | 'acoustic-ring';

export function KoraLogo({
  variant = 'polyhedron',
  size = 34,
}: {
  variant?: LogoVariant;
  size?: number;
}) {
  const Icon =
    variant === 'polyhedron'
      ? Cube
      : variant === 'lunar-wave'
        ? Waves
        : CirclesThree;
  return (
    <Icon
      size={size}
      weight="fill"
      className="shrink-0 text-[var(--accent-primary)]"
      aria-hidden="true"
    />
  );
}
