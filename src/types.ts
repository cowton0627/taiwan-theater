/** 影廳類別：決定一部片在該廳會放映哪個版本 */
export type HallCategory =
  | 'IMAX_GT'      // IMAX GT（底片或 GT 雷射，可放 1.43:1）
  | 'IMAX'         // 數位 IMAX（1.90:1 為最大開口）
  | 'DOLBY_CINEMA' // 杜比影院認證廳（Dolby Vision + Atmos）
  | 'PREMIUM'      // 影城自有品牌巨幕廳 / 特殊場館
  | 'STANDARD';    // 一般廳

export type Region = 'north' | 'central' | 'south' | 'east';

/**
 * 音效認證／系統層級，排序即優劣參考（roadmap 8 的排序依據）。
 * 區分重點：DOLBY_CINEMA 是整廳認證；DVA 只授權 Vision+Atmos 技術（2024 起的新層級）；
 * ATMOS 是音響系統授權安裝。未查證的廳以保守下限 SURROUND_5_1 標記。
 */
export type AudioTier =
  | 'DOLBY_CINEMA' // 杜比影院整廳認證（Vision + Atmos + 聲學環境）
  | 'DVA'          // Dolby Vision + Atmos 授權（非整廳認證，例：大巨蛋秀泰）
  | 'IMAX_12CH'    // IMAX 12.1 聲道（GT／CoLa 雷射）
  | 'IMAX_5CH'     // 數位 IMAX 5/6 聲道標配
  | 'ATMOS'        // Dolby Atmos 授權廳
  | 'AURO_11_1'    // Barco Auro 11.1（目前無已證實案例，保留給查證後使用）
  | 'SURROUND_7_1'
  | 'SURROUND_5_1';

export const AUDIO_TIER_ORDER: AudioTier[] = [
  'DOLBY_CINEMA',
  'DVA',
  'IMAX_12CH',
  'IMAX_5CH',
  'ATMOS',
  'AURO_11_1',
  'SURROUND_7_1',
  'SURROUND_5_1',
];

/** 該層級是否含 Dolby Atmos（取代舊 atmos 布林欄位） */
export function hasAtmos(s: Pick<Screen, 'audioTier'>): boolean {
  return s.audioTier === 'DOLBY_CINEMA' || s.audioTier === 'DVA' || s.audioTier === 'ATMOS';
}

export interface Screen {
  id: string;
  name: string;
  chain: string;
  hallCategory: HallCategory;
  /** 銀幕寬（公尺）；未公布為 null，該廳不納入成像排名 */
  widthM: number | null;
  /** 銀幕高（公尺）；未公布為 null */
  heightM: number | null;
  /** 放映系統：雷射GT / 雷射 / 氙燈 / 8K投影 / LED */
  projection?: string;
  /** 廳的品牌名稱：MUVIE TITAN、鉅院廳、DVA、COACH… */
  brandLabel?: string;
  status: 'operating' | 'closed';
  region: Region;
  city: string;
  /** 音效認證／系統層級；未查證廳為保守下限 SURROUND_5_1 */
  audioTier: AudioTier;
  /** 音響補充描述（自由文字）：聲道數、品牌、待核註記 */
  audio: string;
  /** 座位數；未公布為 null */
  seats: number | null;
  /** 座位數來源與異說註記 */
  seatsNotes?: string;
  /** 訂票 / 場次查詢頁（分店深連結優先，其次分店介紹頁） */
  booking: string;
  /** 完整地址（供 Google Maps 連結）；未收集為缺省 */
  address?: string;
  /** 尺寸是否經過查證（丈量紀錄、官方公布） */
  verified: boolean;
  sources: string[];
  notes?: string;
}

/** 已公布尺寸、可參與成像計算的影廳 */
export type SizedScreen = Screen & { widthM: number; heightM: number };

export function isSized(s: Screen): s is SizedScreen {
  return s.widthM !== null && s.heightM !== null;
}

/** 電影在某類影廳放映的版本（畫幅） */
export interface FilmVersion {
  /** 適用的影廳類別；STANDARD 可能同時有 flat 與 scope 兩版 */
  hallCategory: HallCategory;
  ratio: number;
  label: string;
  /** 畫幅資訊可信度：official=官方公布（預設）、reported=媒體報導、expected=上映前預期值 */
  confidence?: 'official' | 'reported' | 'expected';
}

export interface Film {
  id: string;
  title: string;
  titleEn: string;
  year: number;
  shotOn?: string;
  audio?: string;
  /** 全片片長（分鐘）；未公布 null */
  runtimeMin?: number | null;
  /** 原生大畫幅（IMAX 攝影機等）片段分鐘數；全片拍攝＝等於 runtimeMin；查無出處 null */
  largeFormatMin?: number | null;
  /** 畫幅／格式補充說明（顯示於片名下方） */
  formatNotes?: string;
  versions: FilmVersion[];
  sources: string[];
}

/** 一個畫幅在一面銀幕上的實際成像 */
export interface FitResult {
  screen: SizedScreen;
  version: FilmVersion;
  imageWidthM: number;
  imageHeightM: number;
  imageAreaM2: number;
  /** 佔銀幕面積比例 0–1 */
  screenUsage: number;
  /** STANDARD 廳有多版本時，此廳實際排哪版依影城而定 */
  versionUncertain: boolean;
  /** 此廳類別無專屬版本、退用他類版本計算（特殊廳卡片需標示） */
  versionFallback: boolean;
}
