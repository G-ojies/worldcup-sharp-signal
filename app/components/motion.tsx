"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect } from "react";

/* Shared spring / easing presets (from page-load-animations spring-presets). */
export const SPRING = {
  smooth: { type: "spring" as const, stiffness: 300, damping: 30 },
  bouncy: { type: "spring" as const, stiffness: 280, damping: 26 },
  stiff: { type: "spring" as const, stiffness: 350, damping: 28 },
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
};
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * Count-up number. Dramatic on mount (~0.9s expo), collapses instantly under
 * reduced-motion. Renders a live MotionValue so it never blocks paint.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  signed = false,
  delay = 0,
  duration = 0.9,
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  signed?: boolean;
  delay?: number;
  /** Shorten for counters that chase a playhead, so they don't lag behind it. */
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => {
    const sign = signed && v >= 0 ? "+" : "";
    return `${sign}${prefix}${v.toFixed(decimals)}${suffix}`;
  });

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, delay, ease: EASE_OUT_EXPO });
    return controls.stop;
  }, [value, delay, duration, reduce, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}

/** Section reveal — slides in from a direction with spring; static under reduced-motion. */
export function Reveal({
  show,
  children,
  from = "up",
  delay = 0,
  className,
}: {
  show: boolean;
  children: React.ReactNode;
  from?: "up" | "down" | "left" | "right";
  delay?: number;
  className?: string;
}) {
  const off = 18;
  const hidden =
    from === "up"
      ? { opacity: 0, y: off }
      : from === "down"
        ? { opacity: 0, y: -off }
        : from === "left"
          ? { opacity: 0, x: -off }
          : { opacity: 0, x: off };
  return (
    <motion.div
      className={className}
      initial={hidden}
      animate={show ? { opacity: 1, x: 0, y: 0 } : hidden}
      transition={{ ...SPRING.smooth, delay }}
    >
      {children}
    </motion.div>
  );
}
