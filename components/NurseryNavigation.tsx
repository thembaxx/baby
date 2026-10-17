'use client';

import { useRef, type KeyboardEvent } from 'react';
import { GearSix, Heart, Waveform } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';

export type NurseryTab = 'soothe' | 'care' | 'settings';

const TABS = [
  { id: 'soothe', label: 'Soothe', icon: Waveform },
  { id: 'care', label: 'Care', icon: Heart },
  { id: 'settings', label: 'Settings', icon: GearSix },
] as const;

export function NurseryNavigation({
  activeTab,
  onTabChange,
}: {
  activeTab: NurseryTab;
  onTabChange: (tab: NurseryTab) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const reducedMotion = useReducedMotion();

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft')
      next = (index + TABS.length - 1) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    onTabChange(TABS[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <nav className="nursery-navigation" aria-label="Main navigation">
      <div
        className="nursery-tab-bar"
        role="tablist"
        aria-label="Nursery screens"
      >
        {TABS.map(({ id, label, icon: Icon }, index) => {
          const active = activeTab === id;
          return (
            <motion.button
              key={id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-label={label}
              aria-selected={active}
              aria-controls={`panel-${id}`}
              tabIndex={active ? 0 : -1}
              title={label}
              onClick={() => onTabChange(id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className="nursery-tab"
              whileTap={reducedMotion ? undefined : { scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            >
              {active && (
                <motion.span
                  layoutId="nursery-tab-selection"
                  className="nursery-tab-selection"
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : {
                          type: 'spring',
                          stiffness: 380,
                          damping: 32,
                          mass: 0.85,
                        }
                  }
                  aria-hidden="true"
                />
              )}
              <Icon
                size={24}
                weight={active ? 'fill' : 'regular'}
                className="relative z-10"
                aria-hidden="true"
              />
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
