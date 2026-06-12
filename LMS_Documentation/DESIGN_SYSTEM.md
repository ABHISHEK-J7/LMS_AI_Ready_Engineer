# Design System — AI Ready Engineer

A single, centralized design system governs the entire platform. **No module may
introduce its own colors, spacing, typography, or component variants.** Everything
derives from tokens in `LMS_Shared/src/theme`.

## Source of truth

| Concern | File |
| --- | --- |
| Color tokens (both themes, light + dark) | `LMS_Shared/src/theme/tokens.js` |
| Type / spacing / radius / shadow scales | `LMS_Shared/src/theme/scales.js` |
| Runtime application (CSS variables) | `LMS_Frontend/src/theme/ThemeProvider.jsx` |
| Global stylesheet (consumes variables) | `LMS_Frontend/src/styles/global.css` |
| UI primitives | `LMS_Frontend/src/components/ui/*` |

At runtime, `ThemeProvider` flattens the active theme+mode into CSS custom
properties on `:root` (`--color-primary`, `--space-4`, `--radius-md`, …). Every
component and stylesheet references those variables — never a raw hex value.

## Themes (exactly two)

### 1 · AI Ready Green (default)
| Token | Light | Dark |
| --- | --- | --- |
| Primary / hover / light | `#008738` · `#006D2D` · `#DDF5E6` | (brand unchanged) |
| Secondary / hover / light | `#72BD20` · `#5EA019` · `#EAF7D8` | — |
| Accent / hover / light | `#FFBB00` · `#E6A800` · `#FFF3CC` | — |
| Background · Surface · Border | `#F8FAF8` · `#FFFFFF` · `#DCE7DD` | `#0F1A12` · `#16231A` · `#2A3A2E` |
| Text primary | `#1F2937` | `#F8FAFC` |
| Success/Warning/Error/Info | `#008738` / `#FFBB00` / `#DC2626` / `#72BD20` | — |

### 2 · AI Ready Orange
| Token | Light | Dark |
| --- | --- | --- |
| Primary / hover / light | `#F15D27` · `#D94E1D` · `#FEE8D0` | (brand unchanged) |
| Secondary / hover / light | `#2A2A2A` · `#1F1F1F` · `#E5E5E5` | — |
| Accent / hover / light | `#FEE8D0` · `#F8D9B5` · `#FFF5EA` | — |
| Background · Surface · Border | `#FAFAFA` · `#FFFFFF` · `#E5E7EB` | `#121212` · `#1E1E1E` · `#333333` |
| Text primary | `#2A2A2A` | `#F8FAFC` |
| Success/Warning/Error/Info | `#008738` / `#F15D27` / `#DC2626` / `#2A2A2A` | — |

> In dark mode only the neutral surfaces/text shift; brand, accent, and status
> colors stay identical across modes for cross-mode consistency.

Theme + mode are user-selectable (`ThemeSwitcher`) and persist in `localStorage`.
The admin also sets an institution-wide default via Settings (`activeTheme`).

## Buttons
`primary` (theme primary) · `secondary` (theme secondary) · `outline` · `ghost` ·
`danger` (error red). Sizes `sm/md/lg`, identical radius/typography/hover across all.

## Components
`Button`, `Card` + `CardHeader`, `Input` (label + error), `Badge` (tones), `Spinner`.
All live in `LMS_Frontend/src/components/ui` and share `ui.css`. Add new primitives
there — do not re-style ad hoc.

## Charts
Use `chartSeriesColors(theme)` from `@lms/shared` so every dashboard renders series
in the same theme-driven order.
