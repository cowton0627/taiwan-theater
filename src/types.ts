/** 影廳類別：決定一部片在該廳會放映哪個版本 */
export type HallCategory =
  | 'IMAX_GT'      // IMAX GT（底片或 GT 雷射，可放 1.43:1）
  | 'IMAX'         // 數位 IMAX（1.90:1 為最大開口）
  | 'DOLBY_CINEMA' // 杜比影院認證廳（Dolby Vision + Atmos）
  | 'PREMIUM'      // 影城自有品牌巨幕廳 / 特殊場館
  | 'STANDARD';    // 一般廳

export type Region = 'north' | 'central' | 'south' | 'east';
export type EvidenceLevel =
  | 'official'
  | 'official_indirect'
  | 'secondary_consensus'
  | 'media'
  | 'community'
  | 'conflict'
  | 'stale'
  | 'unknown';
export type ReviewScope = 'auditorium' | 'venue' | 'venue_unspecified';
export type ProvenanceField =
  | 'dimensions'
  | 'projection'
  | 'audio'
  | 'seats'
  | 'price'
  | 'auditoriumNumber'
  | 'bestRows'
  | 'communityNotes';

/**
 * 結構化資料來源（roadmap 33）：卡片可顯示可點連結。
 * url 省略＝該來源本質上無穩定連結（電話詢問、FB 擋外連、當日場次快照）；
 * note 保留完整原句（引用重點、採用值與異說），零資訊損失。
 */
export interface SourceRef {
  /** 顯示名，例：「美麗華官網 IMAX 頁」 */
  label: string;
  url?: string;
  /** 完整原句／引用重點 */
  note?: string;
}

export interface CommunityReview {
  text: string;
  scope: ReviewScope;
  /** 每條心得自己的可信度；不得沿用同卡其他心得。 */
  evidence: EvidenceLevel;
  /** scope=auditorium 時必須指向單一實體廳；未指明廳號不得填。 */
  auditoriumId?: string;
  sources: SourceRef[];
}

export interface FieldProvenance {
  level: EvidenceLevel;
  sourceIndexes?: number[];
  note?: string;
  checkedAt?: string;
}

export type CommunityDimension =
  | 'visualEnvironment'
  | 'equipmentMaintenance'
  | 'seatingComfort'
  | 'soundTuning';
export type CommunityRating = 'positive' | 'mixed' | 'negative' | 'unknown';

export interface CommunityAssessmentItem {
  rating: CommunityRating;
  evidence: EvidenceLevel;
  summary: string;
  sourceIndexes?: number[];
}

export interface CommunityAssessment {
  version: 1;
  dimensions: Record<CommunityDimension, CommunityAssessmentItem>;
}

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

/**
 * 2026-07-29 調整：Atmos／Auro 移到 IMAX 5 聲道之上——以「沉浸聲場」為主軸，
 * 與得分卡的沉浸音效分完全同向（原順序造成 IMAX 5 聲道序位高於 Atmos、分數卻相反的矛盾）。
 */
export const AUDIO_TIER_ORDER: AudioTier[] = [
  'DOLBY_CINEMA',
  'DVA',
  'IMAX_12CH',
  'ATMOS',
  'AURO_11_1',
  'IMAX_5CH',
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
  /** 同一營業據點的穩定識別；影城地址、票價與訂票入口可由此共享。 */
  venueId?: string;
  /** 特殊廳品牌／廳型，與實體廳號分開。 */
  formatBrand?: string;
  /** 實體廳號；null＝官方未公開，不得自行猜測。 */
  auditoriumNumber?: string | null;
  auditoriumNumberEvidence?: EvidenceLevel;
  /** 官網場次／購票畫面使用的名稱，可能只有品牌、沒有數字廳號。 */
  officialBookingLabel?: string;
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
  /** 社群口碑摘要（roadmap 14：經逐條開連結核對後才入庫，出處在 sources 的「口碑：」條目） */
  communityNotes?: string;
  /** 有明確適用範圍的口碑；未指明廳號不得產生特定廳規格或推薦。 */
  communityReviews?: CommunityReview[];
  /** roadmap 14：固定四面向的結構化口碑；自由文字不直接轉成分數。 */
  communityAssessment?: CommunityAssessment;
  /** 推薦座位排（跨帖共識；意見分歧或無可靠來源則缺省） */
  bestRows?: string;
  /** 該廳全票價（平日成人 2D，NTD）；顯示參考、不計入評比；未收集為缺省 */
  priceNTD?: number | null;
  /** 票價備註：假日／3D 差價、價格時點 */
  priceNotes?: string;
  /** 訂票 / 場次查詢頁（分店深連結優先，其次分店介紹頁） */
  booking: string;
  /** 完整地址（供 Google Maps 連結）；未收集為缺省 */
  address?: string;
  /** 尺寸是否經過查證（丈量紀錄、官方公布） */
  verified: boolean;
  /** roadmap 30：欄位各自的可信度；不得再把 verified 解讀為整張卡都已查證。 */
  provenance?: Partial<Record<ProvenanceField, FieldProvenance>>;
  sources: SourceRef[];
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
  /** 此版本是否已確認會在台灣發行；pending 只能作情境模擬。 */
  taiwanStatus?: 'confirmed' | 'unavailable' | 'pending';
  /** 全片／選定場景／尚未公布。 */
  sceneScope?: 'full_film' | 'selected_scenes' | 'unknown';
}

export type SpecialFormat = 'SCREENX' | '4DX' | 'ULTRA_4DX' | 'MX4D' | 'D_BOX';

export interface SpecialFormatRelease {
  format: SpecialFormat;
  market: 'TW';
  releaseStatus: 'confirmed' | 'unavailable' | 'pending';
  /** 原生協作拍攝、動感編碼或後期轉製；未知時不推定。 */
  production?: 'shot_for_screenx' | 'motion_programmed' | 'converted' | 'unknown';
  sceneScope?: 'full_film' | 'selected_scenes' | 'unknown';
  label: string;
  experience?: string;
  /** 對應影廳的 formatBrand／brandLabel，不新增 hallCategory。 */
  applicableBrands: string[];
  sources: SourceRef[];
}

export interface FilmFact {
  label: string;
  evidence: EvidenceLevel;
  sources: SourceRef[];
}

export interface GuideValue {
  value?: string;
  evidence: EvidenceLevel;
}

/** ScreenX 第一階段選擇指南；與正面銀幕排名資料分離，不參與 fit／score。 */
export interface ScreenXGuideEntry {
  id: string;
  venueId?: string;
  venueName?: string;
  name: string;
  chain: string;
  formatBrand?: string;
  auditoriumNumber?: GuideValue;
  officialBookingLabel?: string;
  region: Region;
  city: string;
  address?: string;
  booking: string;
  priceNTD?: number | null;
  priceNotes?: string;
  bestRows?: string;
  bestRowsEvidence?: EvidenceLevel;
  seatLayout?: GuideValue;
  mainScreen: GuideValue;
  /** 主銀幕面積排序用數值；僅在來源給出具體公尺數且無跨源衝突時填入，null／省略＝不參與排序。 */
  mainScreenWidthM?: number | null;
  mainScreenHeightM?: number | null;
  totalWidth: GuideValue;
  projection: GuideValue;
  audio: GuideValue;
  notes?: string;
  reviews?: CommunityReview[];
  sources: SourceRef[];
}

export interface Film {
  id: string;
  title: string;
  titleEn: string;
  year: number;
  shotOn?: string;
  captureFormat?: FilmFact;
  maxConfirmedAspectRatio?: number | null;
  taiwanReleaseStatus?: FilmFact;
  audio?: string;
  /** 全片片長（分鐘）；未公布 null */
  runtimeMin?: number | null;
  /** 原生大畫幅（IMAX 攝影機等）片段分鐘數；全片拍攝＝等於 runtimeMin；查無出處 null */
  largeFormatMin?: number | null;
  /** 畫幅／格式補充說明（顯示於片名下方） */
  formatNotes?: string;
  versions: FilmVersion[];
  specialFormats?: SpecialFormatRelease[];
  sources: SourceRef[];
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
