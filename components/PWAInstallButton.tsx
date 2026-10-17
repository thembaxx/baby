'use client';

import React, { useState } from 'react';
import { DownloadSimple as Download, DeviceMobile as Smartphone, WifiSlash as WifiOff, Check } from '@phosphor-icons/react';
import { usePWAInstall, useOnlineStatus } from '@/hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, swRegistered, install } =
    usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return (
      <span className="text-xs text-emerald-400 flex items-center gap-1.5 whitespace-nowrap shrink-0">
        <Check className="w-3.5 h-3.5" />
        <span>Installed App</span>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (isInstallable) {
            await install();
          } else {
            setShowGuide(true);
          }
        }}
        className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
        <span>{isIOS ? 'Install on iOS' : 'Install PWA'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-[var(--accent-primary)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Install Kora as a Native App
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Close
              </button>
            </div>

            <div className="text-xs text-[var(--text-secondary)] space-y-2.5 leading-relaxed">
              <p>
                Kora runs in standalone full-screen mode with zero browser
                chrome, wake-lock support, and offline acoustic model storage:
              </p>
              <div className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-2">
                <p className="text-[var(--text-primary)] font-medium">
                  iOS / iPadOS Safari:
                </p>
                <p>
                  01. Tap the <strong>Share</strong> icon in the bottom Safari
                  toolbar.
                  <br />
                  02. Select <strong>Add to Home Screen</strong> to install the
                  tactile Kora squircle icon.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-2">
                <p className="text-[var(--text-primary)] font-medium">
                  Desktop Chrome / Edge / Android:
                </p>
                <p>
                  Click the <strong>Install Kora</strong> icon in the address
                  bar (or open this app in a top-level tab outside the preview
                  frame). Service Worker status:{' '}
                  <span className="font-mono text-[var(--accent-primary)]">
                    {swRegistered ? 'Active & Caching' : 'Ready'}
                  </span>
                  .
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="min-h-[44px] w-full rounded-xl bg-[var(--accent-primary)] text-stone-950 text-xs font-semibold transition-transform active:scale-[0.99]"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-2xl bg-amber-400 px-4 py-2.5 text-xs font-semibold text-stone-950 shadow-xl">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Offline Mode Active · Local Acoustic & IndexedDB Cache Ready</span>
    </div>
  );
}
