import React, { createContext, useContext } from 'react';

import type { AppColors } from './colors';
import { appColors } from './palettes';

type ThemeValue = {
  colors: AppColors;
};

const themeValue: ThemeValue = { colors: appColors };

const ThemeContext = createContext<ThemeValue>(themeValue);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeValue {
  return useContext(ThemeContext);
}
