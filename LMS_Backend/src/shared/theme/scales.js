/**
 * Non-color design tokens — the shared spacing/type/radius/shadow scales every
 * component must use. Exposed as CSS variables by the frontend so there is one
 * consistent rhythm across all modules, dashboards, and roles.
 */

export const FONT_FAMILY = {
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
};

/** rem-based type scale. */
export const FONT_SIZE = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
};

export const FONT_WEIGHT = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

/** 4px base spacing scale. */
export const SPACING = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
};

export const RADIUS = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
};

export const SHADOW = {
  sm: '0 1px 2px 0 rgba(16, 24, 40, 0.06)',
  md: '0 4px 12px -2px rgba(16, 24, 40, 0.10), 0 2px 6px -3px rgba(16, 24, 40, 0.06)',
  lg: '0 16px 32px -8px rgba(16, 24, 40, 0.14), 0 6px 12px -6px rgba(16, 24, 40, 0.06)',
  xl: '0 28px 56px -12px rgba(16, 24, 40, 0.24), 0 10px 20px -8px rgba(16, 24, 40, 0.10)',
};

/**
 * Strong custom easing curves — the built-in CSS easings lack punch. The
 * transition shorthands bake in ease-out so UI feels responsive; the standalone
 * --ease-* vars are for bespoke component animations.
 */
export const EASE = {
  out: 'cubic-bezier(0.23, 1, 0.32, 1)', // snappy ease-out for UI
  inOut: 'cubic-bezier(0.77, 0, 0.175, 1)', // on-screen movement
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // subtle overshoot
};

export const TRANSITION = {
  fast: `130ms ${EASE.out}`,
  base: `200ms ${EASE.out}`,
  slow: `320ms cubic-bezier(0.32, 0.72, 0, 1)`,
};

/**
 * Emit the non-color scales as CSS variables (color vars come from tokens.js).
 * @returns {Record<string, string>}
 */
export function scalesToCssVars() {
  const out = {
    '--font-sans': FONT_FAMILY.sans,
    '--font-mono': FONT_FAMILY.mono,
    '--transition-fast': TRANSITION.fast,
    '--transition-base': TRANSITION.base,
    '--transition-slow': TRANSITION.slow,
    '--ease-out': EASE.out,
    '--ease-in-out': EASE.inOut,
    '--ease-spring': EASE.spring,
  };
  for (const [k, v] of Object.entries(FONT_SIZE)) out[`--font-size-${k}`] = v;
  for (const [k, v] of Object.entries(FONT_WEIGHT)) out[`--font-weight-${k}`] = v;
  for (const [k, v] of Object.entries(SPACING)) out[`--space-${k}`] = v;
  for (const [k, v] of Object.entries(RADIUS)) out[`--radius-${k}`] = v;
  for (const [k, v] of Object.entries(SHADOW)) out[`--shadow-${k}`] = v;
  return out;
}
