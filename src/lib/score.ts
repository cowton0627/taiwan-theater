import type { AudioTier, Film, FitResult } from '../types';

/**
 * 綜合得分卡（點數制）：每一分都有可引用依據，公式透明可調。
 * 分值決策（2026-07-30 修訂）：
 * - DVA 取 0.5（同技術授權、無整廳認證）
 * - 認證／授權與沉浸音效是不同維度：Dolby Cinema／DVA 各自取得兩項分數
 * - 沉浸音效限已查證含高度／頭頂聲道或物件式三維定位的系統；
 *   IMAX 5 聲道、5.1、7.1 不計，未查證不推定
 * - 雷射投影 +1；已查證為雙機或 RGB 再 +0.5，兩條件同時成立也不重複
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
  /** 得分卡輸入中尚未查證的項目數；獨立呈現，不改變已確認分數。 */
  unknownCount: number;
  items: ScoreItem[];
}

const IMMERSIVE = new Set<AudioTier>([
  'DOLBY_CINEMA',
  'DVA',
  'ATMOS',
  'IMAX_12CH',
  'AURO_11_1',
]);

const IMMERSIVE_LABEL: Partial<Record<AudioTier, string>> = {
  DOLBY_CINEMA: 'Dolby Atmos',
  DVA: 'Dolby Atmos',
  ATMOS: 'Dolby Atmos',
  IMAX_12CH: 'IMAX 12 聲道',
  AURO_11_1: 'Auro 11.1',
};

/** maxArea＝目前篩選範圍內最大成像面積（㎡），作為面積比例分的分母 */
export function scoreScreen(fit: FitResult, maxArea: number, film: Film | null): ScoreResult {
  const s = fit.screen;
  const items: ScoreItem[] = [];

  if (s.hallCategory === 'IMAX_GT') items.push({ label: '可放映 1.43:1', pts: 1 });
  if (s.audioTier === 'DOLBY_CINEMA') items.push({ label: '杜比影院整廳認證', pts: 1 });
  if (s.audioTier === 'DVA') items.push({ label: 'DVA 授權', pts: 0.5 });
  if (IMMERSIVE.has(s.audioTier)) {
    items.push({ label: `沉浸音效（${IMMERSIVE_LABEL[s.audioTier]}）`, pts: 1 });
  }
  if (s.audioTier === 'SURROUND_5_1') items.push({ label: '音效未查證', pts: 0, unknown: true });

  const proj = s.projection ?? '';
  if (!proj) {
    items.push({ label: '投影未查證', pts: 0, unknown: true });
  } else if (proj.includes('雷射')) {
    items.push({ label: '雷射投影', pts: 1 });
    // 雙機與 RGB 是同一個進階加成；即使兩者並存，仍只加一次 0.5。
    if (proj.includes('雙') || proj.includes('RGB')) {
      items.push({ label: '進階雷射（雙機或 RGB，不重複）', pts: 0.5 });
    }
  } else if (proj.includes('LED')) {
    items.push({ label: 'LED 放映', pts: 1 });
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

  return {
    total: items.reduce((sum, it) => sum + it.pts, 0),
    unknownCount: items.filter((it) => it.unknown).length,
    items,
  };
}
