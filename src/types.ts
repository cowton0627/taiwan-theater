/** 影廳類別：決定一部片在該廳會放映哪個版本 */
export type HallCategory =
  | 'IMAX_GT'      // IMAX GT（底片或 GT 雷射，可放 1.43:1）
  | 'IMAX'         // 數位 IMAX（1.90:1 為最大開口）
  | 'DOLBY_CINEMA' // 杜比影院認證廳（Dolby Vision + Atmos）
  | 'PREMIUM'      // 影城自有品牌巨幕廳 / 特殊場館
  | 'STANDARD';    // 一般廳

export type Region = 'north' | 'central' | 'south' | 'east';

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
  /** 是否為 Dolby Atmos 廳 */
  atmos: boolean;
  audio: string;
  /** 座位數；未公布為 null */
  seats: number | null;
  /** 座位數來源與異說註記 */
  seatsNotes?: string;
  /** 訂票 / 場次查詢頁 */
  booking: string;
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
}

export interface Film {
  id: string;
  title: string;
  titleEn: string;
  year: number;
  shotOn?: string;
  audio?: string;
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
}
