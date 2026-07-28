import type { Film, FilmVersion, FitResult, HallCategory, SizedScreen } from '../types';

/**
 * 畫幅 R 投影在 W×H 銀幕上的最大內接矩形：
 * 片比銀幕寬 → 滿寬、上下留黑；片比銀幕窄 → 滿高、左右留黑。
 */
export function fitImage(
  screen: SizedScreen,
  version: FilmVersion,
): Omit<FitResult, 'versionUncertain' | 'versionFallback'> {
  const screenRatio = screen.widthM / screen.heightM;
  const r = version.ratio;
  const imageWidthM = r >= screenRatio ? screen.widthM : screen.heightM * r;
  const imageHeightM = imageWidthM / r;
  const imageAreaM2 = imageWidthM * imageHeightM;
  return {
    screen,
    version,
    imageWidthM,
    imageHeightM,
    imageAreaM2,
    screenUsage: imageAreaM2 / (screen.widthM * screen.heightM),
  };
}

/** 影廳類別的版本 fallback 順序：找不到專屬版本就往下找 */
const VERSION_FALLBACK: Record<HallCategory, HallCategory[]> = {
  IMAX_GT: ['IMAX_GT', 'IMAX', 'STANDARD'],
  IMAX: ['IMAX', 'STANDARD'],
  DOLBY_CINEMA: ['DOLBY_CINEMA', 'STANDARD'],
  PREMIUM: ['PREMIUM', 'STANDARD'],
  STANDARD: ['STANDARD'],
};

/**
 * 這部片在這面銀幕會呈現的成像。
 * 同類別有多個版本（如一般廳同時發行 1.85 與 2.39）時取成像面積最大者，
 * 並標記 versionUncertain —— 實際放哪版依影城排片而定。
 */
export function fitFilm(screen: SizedScreen, film: Film): FitResult | null {
  for (const cat of VERSION_FALLBACK[screen.hallCategory]) {
    const versions = film.versions.filter((v) => v.hallCategory === cat);
    if (versions.length === 0) continue;
    const fits = versions.map((v) => fitImage(screen, v));
    fits.sort((a, b) => b.imageAreaM2 - a.imageAreaM2);
    return {
      ...fits[0],
      versionUncertain: versions.length > 1,
      // 特殊廳型拿不到專屬版本、退用他類版本 —— 卡片需標示「本片無此廳型版本」
      versionFallback: cat !== screen.hallCategory,
    };
  }
  return null;
}

/** 自訂畫幅模式：所有廳都放同一個比例 */
export function customVersion(ratio: number): FilmVersion {
  return { hallCategory: 'STANDARD', ratio, label: `${ratio}:1` };
}
