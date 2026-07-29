import type { Film, FitResult } from '../types';

/**
 * 綜合得分卡（點數制）：每一分都有可引用依據，公式透明可調。
 * 分值決策（2026-07-29 修訂）：
 * - DVA 取 0.5（同技術授權、無整廳認證）
 * - 面積分＝連續比例 0–2 分（2 ×成像÷範圍內最大成像，取 0.5 級距）——
 *   取代原名次 3/2/1 斷崖：面積有專屬排序模式，綜合評比中不該獨大
 * - 相關項去重：已得「可放映 1.43」者不重複計「放映最大畫幅版」（同一優勢）
 * - 口碑分（0–2）待 roadmap 14 接入，未接入前不計、UI 註明
 * - 未查證（音效／投影）＝0 分＋「？」標記，缺資料不等於差
 */
export interface ScoreItem {
  label: string;
  pts: number;
  /** 資料未查證：0 分但以「？」呈現而非扣分 */
  unknown?: boolean;
}

export interface ScoreResult {
  total: number;
  items: ScoreItem[];
}

const IMMERSIVE = new Set(['DOLBY_CINEMA', 'DVA', 'ATMOS', 'IMAX_12CH', 'AURO_11_1']);

/** maxArea＝目前篩選範圍內最大成像面積（㎡），作為面積比例分的分母 */
export function scoreScreen(fit: FitResult, maxArea: number, film: Film | null): ScoreResult {
  const s = fit.screen;
  const items: ScoreItem[] = [];

  if (s.hallCategory === 'IMAX_GT') items.push({ label: '可放映 1.43:1', pts: 1 });
  if (s.audioTier === 'DOLBY_CINEMA') items.push({ label: '杜比影院整廳認證', pts: 1 });
  if (s.audioTier === 'DVA') items.push({ label: 'DVA 授權', pts: 0.5 });
  if (IMMERSIVE.has(s.audioTier)) items.push({ label: '沉浸音效', pts: 1 });
  if (s.audioTier === 'SURROUND_5_1') items.push({ label: '音效未查證', pts: 0, unknown: true });

  const proj = s.projection ?? '';
  if (!proj) {
    items.push({ label: '投影未查證', pts: 0, unknown: true });
  } else if (proj.includes('雷射') || proj.includes('LED')) {
    // 雷射／LED +1；雙機、RGB、GT 級再 +0.5
    const premium = proj.includes('雙') || proj.includes('RGB') || proj.includes('GT');
    items.push({ label: `投影：${proj}`, pts: premium ? 1.5 : 1 });
  } else {
    items.push({ label: `投影：${proj}`, pts: 0 });
  }

  if (maxArea > 0) {
    const areaPts = Math.round((fit.imageAreaM2 / maxArea) * 2 * 2) / 2;
    items.push({ label: '成像面積比例', pts: areaPts });
  }

  // 已計「可放映 1.43」者不重複計最大畫幅版——同一優勢不三重計分
  if (film && s.hallCategory !== 'IMAX_GT') {
    const ratios = new Set(film.versions.map((v) => v.ratio));
    const min = Math.min(...film.versions.map((v) => v.ratio));
    if (ratios.size > 1 && fit.version.ratio === min) {
      items.push({ label: '放映本片最大畫幅版', pts: 1 });
    }
  }

  return { total: items.reduce((sum, it) => sum + it.pts, 0), items };
}
