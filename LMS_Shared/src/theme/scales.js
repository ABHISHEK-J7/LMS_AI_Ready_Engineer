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
  sm: '0 1px 2px 0 rgba(16, 24, 40, 0.05)',
  md: '0 4px 8px -2px rgba(16, 24, 40, 0.10), 0 2px 4px -2px rgba(16, 24, 40, 0.06)',
  lg: '0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.03)',
};

export const TRANSITION = {
  fast: '120ms ease',
  base: '180ms ease',
  slow: '280ms ease',
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
  };
  for (const [k, v] of Object.entries(FONT_SIZE)) out[`--font-size-${k}`] = v;
  for (const [k, v] of Object.entries(FONT_WEIGHT)) out[`--font-weight-${k}`] = v;
  for (const [k, v] of Object.entries(SPACING)) out[`--space-${k}`] = v;
  for (const [k, v] of Object.entries(RADIUS)) out[`--radius-${k}`] = v;
  for (const [k, v] of Object.entries(SHADOW)) out[`--shadow-${k}`] = v;
  return out;
}
