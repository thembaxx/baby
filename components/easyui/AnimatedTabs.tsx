"use client";
// Adapted from EasyUI AnimatedTabs by Suraj Maurya (MIT).
// https://github.com/Surajmaurya1/easyui/blob/main/src/components/ui/AnimatedTabs.tsx
import { useId, useRef, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";

interface Tab {
  id: string;
  label: string;
}
export function AnimatedTabs({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly Tab[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const id = useId();
  const reducedMotion = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const keydown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLButtonElement) || !event.target.dataset.easyuiSegment) return;
    const current = items.findIndex((item) => item.id === value);
    if (current < 0 || !items.length) return;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (current + 1) % items.length
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (current + items.length - 1) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div
      className="easyui-animated-tabs haptic-options"
      role="group"
      aria-label={label}
      onKeyDown={keydown}
    >
      {items.map((item, index) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            data-easyui-segment="true"
            type="button"
            ref={(node) => {
              refs.current[index] = node;
            }}
            aria-pressed={active}
            onClick={() => {
              if (!active) onChange(item.id);
            }}
          >
            {active &&
              (reducedMotion ? (
                <span className="easyui-active-pill" aria-hidden="true" />
              ) : (
                <motion.span
                  layoutId={`kora-easyui-${id}`}
                  className="easyui-active-pill"
                  aria-hidden="true"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ))}
            <span className="easyui-tab-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
