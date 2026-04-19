import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { AppColors } from './colors';
import { paletteMorning } from './palettes';
import type { DayPhase } from './timeOfDay';
import { getColorsAt, getDayPhase } from './timeOfDay';

type ThemeValue = {
  colors: AppColors;
  phase: DayPhase;
};

const ThemeContext = createContext<ThemeValue>({
  colors: paletteMorning,
  phase: 'morning',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const id = setInterval(bump, 30_000);
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') bump();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const now = new Date();
    return {
      colors: getColorsAt(now),
      phase: getDayPhase(now),
    };
  }, [tick]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeValue {
  return useContext(ThemeContext);
}
