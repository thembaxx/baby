"use client";
// Adapted from EasyUI UnfoldAccordion by Suraj Maurya (MIT).
// https://github.com/Surajmaurya1/easyui/blob/main/src/components/ui/UnfoldAccordion.tsx
import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretDown } from "@phosphor-icons/react";
export function UnfoldAccordion({ title, children }: { title: string; children: ReactNode }) {
  const id = useId(),
    reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  return (
    <div className="easyui-unfold-accordion">
      <button
        type="button"
        id={id + "-trigger"}
        aria-expanded={open}
        aria-controls={id + "-panel"}
        onClick={() => setOpen((v) => !v)}
        className="easyui-unfold-trigger"
      >
        <span>{title}</span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 180 : 0 }}
          transition={
            reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 28 }
          }
        >
          <CaretDown size={17} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            id={id + "-panel"}
            role="region"
            aria-labelledby={id + "-trigger"}
            className="easyui-unfold-content"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={
              reducedMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { height: 0, opacity: 0 }
            }
            transition={
              reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 310, damping: 34 }
            }
          >
            <div className="easyui-unfold-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
