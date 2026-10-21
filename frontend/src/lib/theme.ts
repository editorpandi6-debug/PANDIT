export type InterfaceTheme = "agni" | "vajra";

/**
 * VAJRA Core is rendered by hue-rotating the AGNI Portal's fire palette into electric
 * blue/cyan — every existing glow/hud/particle component works unchanged in both themes.
 */
export const VAJRA_FILTER = "hue-rotate(158deg) saturate(1.5) brightness(1.08)";

export function themeFilter(theme: InterfaceTheme): string | undefined {
  return theme === "vajra" ? VAJRA_FILTER : undefined;
}
