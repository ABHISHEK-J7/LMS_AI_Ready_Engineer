import { Moon, Palette, Sun } from 'lucide-react';
import { ThemeMode, ThemeName } from '@/shared';
import { useTheme } from '@/theme/ThemeProvider';

export function ThemeSwitcher() {
  const { theme, mode, setTheme, toggleMode } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <button
        className="btn btn--ghost btn--sm"
        title="Switch theme"
        onClick={() => setTheme(theme === ThemeName.GREEN ? ThemeName.ORANGE : ThemeName.GREEN)}
      >
        <Palette size={15} strokeWidth={2} style={{ color: 'var(--color-primary)' }} />
        {theme === ThemeName.GREEN ? 'Green' : 'Orange'}
      </button>
      <button className="btn btn--ghost btn--sm" title="Toggle dark mode" onClick={toggleMode}>
        {mode === ThemeMode.LIGHT ? <Moon size={15} strokeWidth={2} /> : <Sun size={15} strokeWidth={2} />}
      </button>
    </div>
  );
}
