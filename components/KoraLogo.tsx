'use client';

import React from 'react';

export type LogoVariant = 'polyhedron' | 'lunar-wave' | 'acoustic-ring';

interface KoraLogoProps {
  variant?: LogoVariant;
  size?: number;
}

export function KoraLogo({ variant = 'polyhedron', size = 34 }: KoraLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 select-none transition-transform duration-200 group-hover:scale-105"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="koraSq" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1b1630" />
          <stop offset="55%" stopColor="#0f0c1b" />
          <stop offset="100%" stopColor="#08060c" />
        </linearGradient>
        <linearGradient id="koraGoldL" x1="20" y1="14" x2="44" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="koraGoldD" x1="24" y1="18" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="koraWave" x1="12" y1="30" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="koraRim" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* Tactile Apple Design Award Squircle Base */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="15"
        fill="url(#koraSq)"
        stroke="url(#koraRim)"
        strokeWidth="1.5"
      />

      {variant === 'polyhedron' && (
        <>
          {/* Lower Lunar Ocean Wave Cradle */}
          <path
            d="M12 36C17 31 25 32 32 36C39 40 47 39 52 35C49 46 41 53 32 53C23 53 15 46 12 36Z"
            fill="url(#koraWave)"
          />
          {/* 3D Faceted Golden Polyhedral Star */}
          <g transform="translate(32, 27)">
            <polygon points="0,-13 4,-4 0,0" fill="url(#koraGoldL)" />
            <polygon points="0,-13 -4,-4 0,0" fill="url(#koraGoldD)" />
            <polygon points="12,-4 4,2 0,0" fill="url(#koraGoldL)" />
            <polygon points="12,-4 4,-4 0,0" fill="url(#koraGoldD)" />
            <polygon points="8,10 0,5 0,0" fill="url(#koraGoldL)" />
            <polygon points="8,10 4,2 0,0" fill="url(#koraGoldD)" />
            <polygon points="-8,10 -4,2 0,0" fill="url(#koraGoldL)" />
            <polygon points="-8,10 0,5 0,0" fill="url(#koraGoldD)" />
            <polygon points="-12,-4 -4,-4 0,0" fill="url(#koraGoldL)" />
            <polygon points="-12,-4 -4,2 0,0" fill="url(#koraGoldD)" />
            <polygon points="0,-5 5,-1.5 3,4 -3,4 -5,-1.5" fill="#fef9c3" />
          </g>
          {/* Pearl Moon Orb */}
          <circle cx="44" cy="18" r="2.8" fill="#fafaf9" />
        </>
      )}

      {variant === 'lunar-wave' && (
        <>
          <circle cx="32" cy="32" r="21" fill="#0c192c" stroke="#bae6fd" strokeOpacity="0.3" strokeWidth="1.2" />
          <path
            d="M11 32C16 25 24 25 32 32C40 39 48 39 53 32C53 43.5 43.5 53 32 53C20.5 53 11 43.5 11 32Z"
            fill="url(#koraWave)"
          />
          <circle cx="40" cy="23" r="4.5" fill="#fafaf9" />
          <circle cx="23" cy="25" r="2.5" fill="#fbbf24" />
        </>
      )}

      {variant === 'acoustic-ring' && (
        <>
          <circle cx="32" cy="32" r="20" stroke="#f43f5e" strokeWidth="3.5" strokeOpacity="0.85" />
          <circle cx="32" cy="32" r="14.5" stroke="#38bdf8" strokeWidth="3.5" strokeOpacity="0.9" />
          <circle cx="32" cy="32" r="9" fill="#fafaf9" />
          <circle cx="32" cy="32" r="4.5" fill="#0f172a" />
        </>
      )}
    </svg>
  );
}
