'use client';
// Adapted from EasyUI SpotlightCard by Suraj Maurya (MIT).
// https://github.com/Surajmaurya1/easyui/blob/main/src/components/ui/SpotlightCard.tsx
import { useRef, type HTMLAttributes, type ReactNode } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'motion/react';
export function SpotlightCard({ children, className, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  const reducedMotion = useReducedMotion();
  const gradient = useMotionTemplate`radial-gradient(340px circle at ${x}px ${y}px, color-mix(in srgb, var(--accent-primary) 13%, transparent), transparent 78%)`;
  return <div {...props} ref={ref} className={`easyui-spotlight-card ${className || ''}`}
    onPointerMove={event => {
      if (reducedMotion || event.pointerType !== 'mouse' || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      x.set(event.clientX - rect.left);
      y.set(event.clientY - rect.top);
    }}
    onPointerLeave={() => { x.set(-1000); y.set(-1000); }}>
    <motion.span aria-hidden="true" className="easyui-spotlight-glow" style={{ background: gradient }} />
    <div className="easyui-spotlight-content">{children}</div>
  </div>;
}
