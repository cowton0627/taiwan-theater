/** 影廳類別：決定一部片在該廳會放映哪個版本 */
export type HallCategory =
  | 'IMAX_GT'      // IMAX GT（底片或 GT 雷射，可放 1.43:1）
  | 'IMAX'         // 數位 IMAX（1.90:1 為最大開口）
  | 'DOLBY_CINEMA' // 杜比影院認證廳
  | 'PREMIUM'      // 影城自有品牌大廳 / 特殊場館
  | 'STANDARD';    // 一般廳

export type Region = 'north' | 'central' | 'south' | 'east';

export interface Screen {
  id: string;
  name: string;
  chain: string;
  hallCategory: HallCategory;
  /** 銀幕寬（公尺） */
  widthM: number;
  /** 銀幕高（公尺） */
  heightM: number;
  region: Region;
  city: string;
  /** 是否為 Dolby Atmos 廳 */
  atmos: boolean;
  audio: string;
  /** 訂票 / 場次查詢頁 */
  booking: string;
  /** 尺寸是否經過查證（丈量紀錄、官方公布） */
  verified: boolean;
  sources: string[];
  notes?: string;
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
  screen: Screen;
  version: FilmVersion;
  imageWidthM: number;
  imageHeightM: number;
  imageAreaM2: number;
  /** 佔銀幕面積比例 0–1 */
  screenUsage: number;
  /** STANDARD 廳有多版本時，此廳實際排哪版依影城而定 */
  versionUncertain: boolean;
}
