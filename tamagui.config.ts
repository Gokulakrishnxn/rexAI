import { config as defaultConfig } from '@tamagui/config';
import { createTamagui } from 'tamagui';

/**
 * Tamagui config for Rex Healthify.
 * Custom theme overrides in src/theme/brand.ts.
 */
const config = createTamagui(defaultConfig);

export type RexHealthifyConfig = typeof config;
declare module 'tamagui' {
  interface TamaguiCustomConfig extends RexHealthifyConfig {}
}

export default config;
