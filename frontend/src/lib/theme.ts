export type InterfaceTheme = "agni" | "vajra";

/**
 * NOVA STRIKE is rendered by hue-rotating the IGNIS RIFT fire palette into electric
 * blue/cyan — every existing glow/hud/particle component works unchanged in both themes.
 */
export const VAJRA_FILTER = "hue-rotate(158deg) saturate(1.5) brightness(1.08)";

export function themeFilter(theme: InterfaceTheme): string | undefined {
  return theme === "vajra" ? VAJRA_FILTER : undefined;
}
