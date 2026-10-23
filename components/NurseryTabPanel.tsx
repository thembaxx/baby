"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { NurseryTab } from "./NurseryNavigation";

gsap.registerPlugin(useGSAP);

export function NurseryTabPanel({
  tab,
  active,
  children,
}: {
  tab: NurseryTab;
  active: boolean;
  children: ReactNode;
}) {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        ".panel-content > *",
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.045,
          ease: "power3.out",
          clearProps: "transform,opacity",
        },
      );
    },
    { scope, dependencies: [active], revertOnUpdate: true },
  );

  return (
    <section
      ref={scope}
      id={`panel-${tab}`}
      role="tabpanel"
      aria-labelledby={`tab-${tab}`}
      hidden={!active}
      inert={!active}
      tabIndex={0}
      className="nursery-panel"
    >
      <div className="panel-content">{children}</div>
    </section>
  );
}
