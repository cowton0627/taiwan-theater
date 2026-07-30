import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import screensData from './data/screens.json';
import filmsData from './data/films.json';
import { customVersion, fitFilm, fitImage } from './lib/fit';
import { scoreScreen } from './lib/score';
import type { ScoreResult } from './lib/score';
import { AUDIO_TIER_ORDER, isSized } from './types';
import type { AudioTier, Film, FitResult, HallCategory, Region, Screen } from './types';

const screens = screensData as Screen[];
const films = filmsData as Film[];

const REGION_LABELS: Record<Region, string> = {
  north: '北部',
  central: '中部',
  south: '南部',
  east: '東部與離島',
};

const CATEGORY_LABELS: Record<HallCategory, string> = {
  IMAX_GT: 'IMAX GT',
  IMAX: 'IMAX',
  DOLBY_CINEMA: '杜比影院',
  PREMIUM: '特殊廳',
  STANDARD: '一般廳',
};

const CUSTOM_RATIOS = [1.43, 1.85, 1.9, 2.2, 2.39];

/** 品牌分組鍵：子品牌歸入母集團（例：威秀影城（MUVIE）→ 威秀影城） */
const chainKey = (chain: string) => chain.replace(/（.*）$/, '');

/** 「其他」chip 的哨兵值：涵蓋所有單廳小品牌 */
const OTHER_CHAINS = '__other__';

/** 城市 chips 的地理順序（北→南→東→離島）；不在表內的城市排最後 */
const CITY_ORDER = [
  '基隆市',
  '台北市',
  '新北市',
  '桃園市',
  '新竹市',
  '新竹縣',
  '苗栗縣',
  '台中市',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義市',
  '嘉義縣',
  '台南市',
  '高雄市',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '台東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
];
const cityOrder = (c: string) => {
  const i = CITY_ORDER.indexOf(c);
  return i === -1 ? CITY_ORDER.length : i;
};

/** 頁面載入時的 URL 參數——所有狀態的初始值來源（可分享、F5 不歸零） */
const INIT_PARAMS = new URLSearchParams(window.location.search);

function initSetParam<T extends string>(key: string, valid: (v: string) => boolean): Set<T> {
  const raw = INIT_PARAMS.get(key);
  if (!raw) return new Set();
  return new Set(raw.split(',').filter(valid) as T[]);
}

/** 營運中 ≥2 廳的品牌才有獨立 chip（依廳數排序）；單廳品牌收進「其他」 */
const { MAJOR_CHAINS, MINOR_CHAINS } = (() => {
  const counts = new Map<string, number>();
  for (const s of screens) {
    if (s.status !== 'operating') continue;
    const key = chainKey(s.chain);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'),
  );
  return {
    MAJOR_CHAINS: sorted.filter(([, n]) => n >= 2).map(([key]) => key),
    MINOR_CHAINS: new Set(sorted.filter(([, n]) => n < 2).map(([key]) => key)),
  };
})();

const AUDIO_TIER_LABELS: Record<AudioTier, string> = {
  DOLBY_CINEMA: 'Dolby Cinema',
  DVA: 'DVA',
  IMAX_12CH: 'IMAX 12 聲道',
  IMAX_5CH: 'IMAX 5 聲道',
  ATMOS: 'Atmos',
  AURO_11_1: 'Auro 11.1',
  SURROUND_7_1: '7.1 聲道',
  SURROUND_5_1: '音效未查證',
};

/** 城市顯示：有地址時連到 Google Maps 搜尋，否則純文字 */
function CityLink({ s }: { s: Screen }) {
  if (!s.address) return <>{s.city}</>;
  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`}
      target="_blank"
      rel="noreferrer"
      title={s.address}
    >
      {s.city} 📍
    </a>
  );
}

/** 資料來源與查證展開區（roadmap 33）：每筆來源可點、附完整引用句 */
function SourcesFold({ sources }: { sources: Screen['sources'] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <details className="sources-fold">
      <summary>資料來源與查證（{sources.length}）</summary>
      <ul>
        {sources.map((r, i) => (
          <li key={i}>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.label}
              </a>
            ) : (
              <span>{r.label}</span>
            )}
            {r.note && r.note !== r.label && <span className="src-note">──{r.note}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** 廳型欄位合併類別與品牌，避免「杜比影院／Dolby Cinema」同義資訊重複。 */
function hallTypeLabel(s: Screen) {
  if (s.hallCategory === 'DOLBY_CINEMA') return '杜比影院';
  if (s.brandLabel === 'DVA') return 'DVA 特殊廳';
  if (s.brandLabel) return `${s.brandLabel}（${CATEGORY_LABELS[s.hallCategory]}）`;
  return CATEGORY_LABELS[s.hallCategory];
}

function SpecField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`spec-field ${className}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function audioLevel(s: Screen) {
  if (s.audioTier === 'SURROUND_5_1') return null;
  return AUDIO_TIER_ORDER.length - AUDIO_TIER_ORDER.indexOf(s.audioTier);
}

/** 無銀幕尺寸卡：音效排序時進主排名，其餘模式留在資料徵集摺疊。 */
function UnsizedScreenCard({
  s,
  rank,
  audioRanking = false,
}: {
  s: Screen;
  rank?: number;
  audioRanking?: boolean;
}) {
  const level = audioLevel(s);
  return (
    <article className={audioRanking ? 'card card-audio-unsized' : 'card card-unsized'}>
      <div className={audioRanking ? 'rank rank-audio' : 'rank'}>{rank ?? '–'}</div>
      <div className="card-body">
        <h3>{s.name}</h3>
        <p className="key-takeaway">
          {audioRanking
            ? `${AUDIO_TIER_LABELS[s.audioTier]}；銀幕尺寸尚未公布`
            : '銀幕尺寸尚未公布，暫不納入成像排名'}
        </p>
        <p className="meta">
          <CityLink s={s} /> ・{' '}
          {s.priceNTD != null ? (
            <span className="price" title={s.priceNotes ?? '全票價僅供參考，不計入排序'}>
              全票 {s.priceNTD} 元 ・{' '}
            </span>
          ) : (
            <span className="price">票價待確認 ・ </span>
          )}
          <a href={s.booking} target="_blank" rel="noreferrer">
            查場次
          </a>
        </p>
        <details className="evidence-fold">
          <summary>規格與依據</summary>
          <dl className="spec-grid">
            <SpecField label="廳型">{hallTypeLabel(s)}</SpecField>
            <SpecField label="投影">{s.projection ?? '未公布'}</SpecField>
            <SpecField
              label="音效"
              className={s.audioTier === 'SURROUND_5_1' ? 'spec-unknown' : ''}
            >
              {AUDIO_TIER_LABELS[s.audioTier]}
              {s.audio && `（${s.audio}）`}
            </SpecField>
          </dl>
          <p className="evidence-note">
            查證狀態：銀幕尺寸尚無可核對資料
            {s.notes && ` ・ ${s.notes}`}
          </p>
          {(s.bestRows || s.communityNotes) && (
            <p className="community-line">
              {s.bestRows && <strong>💺 推薦座位 {s.bestRows}</strong>}
              {s.bestRows && s.communityNotes && ' ・ '}
              {s.communityNotes}
            </p>
          )}
          <SourcesFold sources={s.sources} />
        </details>
      </div>
      {audioRanking && (
        <div
          className="card-area card-area-audio"
          title="音效層級序位（8＝最高；認證／規格層級排序，非實測音質；未查證顯示？）"
        >
          {level == null ? (
            '？'
          ) : (
            <>
              {level}
              <span className="unit">／8 級</span>
            </>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * 疊圖比較：前幾名影廳的成像框以同一公尺比例尺、水平＋垂直置中疊放，可收合。
 * 置中對齊呼應實際放映的裁切方式——不同畫幅版本是對稱地裁上下（或左右），
 * 疊圖因此直接呈現「可視範圍」的差異。
 */
function OverlayCompare({
  fits,
  selected,
  onClear,
  listResorted,
}: {
  fits: FitResult[];
  selected: FitResult[];
  onClear: () => void;
  /** 下方列表以音效層級／綜合評比重排——疊圖需自我聲明固定按面積 */
  listResorted: boolean;
}) {
  /** 行動版預設收合（U-1：首屏讓位給決策摘要與第一張卡） */
  const [open, setOpen] = useState(() => !window.matchMedia('(max-width: 640px)').matches);
  /** 圖例 hover 中的項目——對應線框高亮、其餘淡出（色弱輔助之一，另有線框序號） */
  const [hovered, setHovered] = useState<number | null>(null);
  const comparing = selected.length > 0;
  const top = (comparing ? selected : fits).slice(0, 6);
  if (top.length === 0) return null;
  const maxWm = Math.max(...top.map((f) => f.imageWidthM));
  const maxHm = Math.max(...top.map((f) => f.imageHeightM));
  const width = 720;
  const scale = width / (maxWm * 1.06);
  const height = maxHm * scale * 1.12;
  const cx = width / 2;
  const cy = height / 2;

  // 以畫面中心為原點、每 5 公尺一條的對稱格線
  const gridStep = 5 * scale;
  const gridXs: number[] = [];
  for (let d = 0; cx + d <= width; d += gridStep) {
    gridXs.push(cx + d);
    if (d > 0) gridXs.push(cx - d);
  }
  const gridYs: number[] = [];
  for (let d = 0; cy + d <= height; d += gridStep) {
    gridYs.push(cy + d);
    if (d > 0) gridYs.push(cy - d);
  }
  return (
    <section className="overlay-section">
      <div className="overlay-head">
        <button
          className="overlay-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={open ? 'caret open' : 'caret'}>▸</span>
          {comparing
            ? `疊圖比較（自選 ${top.length} 廳，同比例尺；格線每 5 公尺，＋為畫面中心）`
            : `疊圖比較（前 ${top.length} 名成像，同比例尺；格線每 5 公尺，＋為畫面中心）`}
        </button>
        {comparing ? (
          <button className="overlay-clear" onClick={onClear}>
            清除自選
          </button>
        ) : (
          <span className="overlay-hint">
            {listResorted
              ? '疊圖固定顯示面積前 6，不隨排序模式變動'
              : '點下方卡片可自選比較（最多 6 廳）'}
          </span>
        )}
      </div>
      {open && (
        <>
          <svg
            className="overlay"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="影廳成像大小疊圖比較"
          >
            {gridXs.map((x) => (
              <line key={`gx${x}`} x1={x} y1={0} x2={x} y2={height} className="grid-line" />
            ))}
            {gridYs.map((y) => (
              <line key={`gy${y}`} x1={0} y1={y} x2={width} y2={y} className="grid-line" />
            ))}
            <line x1={cx - 9} y1={cy} x2={cx + 9} y2={cy} className="center-mark" />
            <line x1={cx} y1={cy - 9} x2={cx} y2={cy + 9} className="center-mark" />
            {(() => {
              // 成像尺寸相同的框會完全重合、互相遮蓋——
              // 同尺寸的第 2 框起改用虛線並錯開起點，讓每廳顏色都可見；
              // 每框左上角掛序號（同尺寸者橫向錯開），色弱也能對回圖例
              const sizeSeen = new Map<string, number>();
              return top.map((f, i) => {
                const w = f.imageWidthM * scale;
                const h = f.imageHeightM * scale;
                const key = `${f.imageWidthM.toFixed(2)}x${f.imageHeightM.toFixed(2)}`;
                const dup = sizeSeen.get(key) ?? 0;
                sizeSeen.set(key, dup + 1);
                const x = (width - w) / 2;
                const y = (height - h) / 2;
                const stateClass =
                  hovered === null ? '' : hovered === i ? ' hot' : ' dim';
                const lead = i === 0 ? ' lead' : '';
                return (
                  <g key={f.screen.id} className={`overlay-item${lead}${stateClass}`}>
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      className={`overlay-rect overlay-rect-${i}`}
                      strokeDasharray={dup > 0 ? '10 10' : undefined}
                      strokeDashoffset={dup > 0 ? dup * 10 : undefined}
                    />
                    <text
                      x={x + 6 + dup * 16}
                      y={y + 15}
                      className={`overlay-num overlay-num-${i}`}
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              });
            })()}
            {(() => {
              // 1.7m 人形比例參照：站在最高成像框的底緣、置中偏右避開中心十字
              const personH = 1.7 * scale;
              const yFeet = (height + maxHm * scale) / 2;
              const px = cx + gridStep * 0.6;
              const headR = personH * 0.13;
              return (
                <g className="person-mark">
                  <title>身高 1.7m 比例參照</title>
                  <circle cx={px} cy={yFeet - personH + headR} r={headR} />
                  <line x1={px} y1={yFeet - personH + headR * 2} x2={px} y2={yFeet - personH * 0.32} />
                  <line x1={px - headR} y1={yFeet - personH * 0.62} x2={px + headR} y2={yFeet - personH * 0.62} />
                  <line x1={px} y1={yFeet - personH * 0.32} x2={px - headR} y2={yFeet} />
                  <line x1={px} y1={yFeet - personH * 0.32} x2={px + headR} y2={yFeet} />
                  <text x={px + headR + 4} y={yFeet - personH * 0.45} className="person-label">
                    1.7m
                  </text>
                </g>
              );
            })()}
          </svg>
          <ul className="overlay-legend">
            {top.map((f, i) => (
              <li
                key={f.screen.id}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className={`swatch swatch-${i}`} />
                {i + 1}. {f.screen.name}（{f.imageAreaM2.toFixed(0)} ㎡）
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function App() {
  const [filmId, setFilmId] = useState<string>(() => {
    const f = INIT_PARAMS.get('film');
    if (f === 'custom' || films.some((x) => x.id === f)) return f as string;
    return films[0]?.id ?? 'custom';
  });
  const [customRatio, setCustomRatio] = useState<number>(() => {
    const v = parseFloat(INIT_PARAMS.get('ratio') ?? '');
    return !Number.isNaN(v) && v >= 0.5 && v <= 4 ? v : 2.39;
  });
  /** 任意比例輸入框的原始字串（允許打字中間狀態，合法時才寫入 customRatio） */
  const [ratioInput, setRatioInput] = useState<string>(() => {
    const v = parseFloat(INIT_PARAMS.get('ratio') ?? '');
    return !Number.isNaN(v) && v >= 0.5 && v <= 4 ? String(v) : '2.39';
  });
  /** 行動版控制列：選完收成一行摘要（U-1／UI-REVIEW P0-2）；桌面恆展開 */
  const [controlsOpen, setControlsOpen] = useState(
    () => !window.matchMedia('(max-width: 640px)').matches,
  );
  /** 短暫回饋訊息（如自選達上限） */
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };
  const [regions, setRegions] = useState<Set<Region>>(() =>
    initSetParam<Region>('region', (v) => v in REGION_LABELS),
  );
  /** 品牌篩選；空集合＝全部；URL 中「其他」以 other 表示 */
  const [chains, setChains] = useState<Set<string>>(() => {
    const set = initSetParam<string>(
      'chain',
      (v) => v === 'other' || MAJOR_CHAINS.includes(v),
    );
    if (set.delete('other')) set.add(OTHER_CHAINS);
    return set;
  });
  /** 城市篩選；僅在選了地區時顯示 chips，空集合＝該區全部 */
  const [cities, setCities] = useState<Set<string>>(() =>
    initSetParam<string>('city', (v) => screens.some((s) => s.city === v)),
  );
  /** 自選比較的影廳 id；空集合＝疊圖顯示預設前 6 名 */
  const [selected, setSelected] = useState<Set<string>>(() =>
    initSetParam<string>('sel', (v) => screens.some((s) => s.id === v)),
  );
  /** 排序：成像面積（預設）／音效層級／綜合評比 */
  const [sortMode, setSortMode] = useState<'area' | 'audio' | 'score'>(() => {
    const v = INIT_PARAMS.get('sort');
    return v === 'audio' || v === 'score' ? v : 'area';
  });

  /** 狀態 → URL（replaceState 不塞瀏覽紀錄；預設值省略、保持網址乾淨） */
  useEffect(() => {
    const p = new URLSearchParams();
    if (filmId !== (films[0]?.id ?? 'custom')) p.set('film', filmId);
    if (filmId === 'custom' && customRatio !== 2.39) p.set('ratio', String(customRatio));
    if (regions.size > 0) p.set('region', Array.from(regions).join(','));
    if (chains.size > 0)
      p.set(
        'chain',
        Array.from(chains)
          .map((c) => (c === OTHER_CHAINS ? 'other' : c))
          .join(','),
      );
    if (sortMode !== 'area') p.set('sort', sortMode);
    if (cities.size > 0) p.set('city', Array.from(cities).join(','));
    if (selected.size > 0) p.set('sel', Array.from(selected).join(','));
    const qs = p.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [filmId, customRatio, regions, chains, sortMode, cities, selected]);

  const film = films.find((f) => f.id === filmId) ?? null;

  /** 已選地區內的城市選項（依地理位置北→南排序）；未選地區時不展開城市層 */
  const cityOptions = useMemo(() => {
    if (regions.size === 0) return [];
    const set = new Set<string>();
    for (const s of screens) {
      if (s.status !== 'operating' || !regions.has(s.region)) continue;
      set.add(s.city);
    }
    return Array.from(set).sort(
      (a, b) => cityOrder(a) - cityOrder(b) || a.localeCompare(b, 'zh-Hant'),
    );
  }, [regions]);

  /** 只採計目前地區範圍內的城市選取——切換地區時殘留選取自動失效 */
  const activeCities = useMemo(
    () => new Set(Array.from(cities).filter((c) => cityOptions.includes(c))),
    [cities, cityOptions],
  );

  const pool = useMemo(
    () =>
      screens
        .filter((s) => s.status === 'operating')
        .filter((s) => regions.size === 0 || regions.has(s.region))
        .filter((s) => activeCities.size === 0 || activeCities.has(s.city))
        .filter(
          (s) =>
            chains.size === 0 ||
            chains.has(chainKey(s.chain)) ||
            (chains.has(OTHER_CHAINS) && MINOR_CHAINS.has(chainKey(s.chain))),
        ),
    [regions, chains, activeCities],
  );

  const fits = useMemo(() => {
    const results = pool
      .filter(isSized)
      .map((s) =>
        film
          ? fitFilm(s, film)
          : {
              ...fitImage(s, customVersion(customRatio)),
              versionUncertain: false,
              versionFallback: false,
            },
      )
      .filter((r): r is FitResult => r !== null);
    results.sort((a, b) => b.imageAreaM2 - a.imageAreaM2);
    return results;
  }, [film, customRatio, pool]);

  /** 得分卡：以面積名次（目前篩選範圍）＋廳規格計分；口碑分待 roadmap 14 */
  const scoreMap = useMemo(() => {
    const m = new Map<string, ScoreResult>();
    const max = fits[0]?.imageAreaM2 ?? 0;
    fits.forEach((f) => m.set(f.screen.id, scoreScreen(f, max, film)));
    return m;
  }, [fits, film]);

  const fitMap = useMemo(
    () => new Map(fits.map((fit) => [fit.screen.id, fit])),
    [fits],
  );

  /** 排名列表的顯示順序；疊圖不受排序模式影響、永遠按面積取前 6 */
  const ranked = useMemo(() => {
    if (sortMode === 'area') return fits;
    if (sortMode === 'score') {
      return [...fits].sort((a, b) => {
        const diff =
          (scoreMap.get(b.screen.id)?.total ?? 0) - (scoreMap.get(a.screen.id)?.total ?? 0);
        return diff !== 0 ? diff : b.imageAreaM2 - a.imageAreaM2;
      });
    }
    return fits;
  }, [fits, sortMode, scoreMap]);

  /**
   * 音效排序不依賴銀幕尺寸：所有營運中且符合篩選的影廳都納入。
   * 同層級先列有尺寸者並按面積排序，再列無尺寸者；未查證音效層級固定在最後。
   */
  const audioRanked = useMemo(
    () =>
      [...pool].sort((a, b) => {
        const tierDiff =
          AUDIO_TIER_ORDER.indexOf(a.audioTier) - AUDIO_TIER_ORDER.indexOf(b.audioTier);
        if (tierDiff !== 0) return tierDiff;
        const aFit = fitMap.get(a.id);
        const bFit = fitMap.get(b.id);
        if (aFit && !bFit) return -1;
        if (!aFit && bFit) return 1;
        if (aFit && bFit) return bFit.imageAreaM2 - aFit.imageAreaM2;
        return a.name.localeCompare(b.name, 'zh-Hant');
      }),
    [pool, fitMap],
  );

  /** 尺寸未公布廳（單一清單；地區語意交給篩選器，避免多個「第 1 名」歧義） */
  const unsized = useMemo(
    () => (sortMode === 'audio' ? [] : pool.filter((s) => !isSized(s))),
    [pool, sortMode],
  );

  const toggleRegion = (r: Region) => {
    setRegions((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const toggleChain = (c: string) => {
    setChains((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const toggleCity = (c: string) => {
    setCities((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  /** 依成像面積排序的自選比較清單（跨區也可比） */
  const selectedFits = useMemo(
    () => fits.filter((f) => selected.has(f.screen.id)),
    [fits, selected],
  );

  /** 決策摘要一行（UI-REVIEW P0-1）：把數據翻成結論，隨選片／篩選／排序更新 */
  const insight = useMemo(() => {
    const scoped = regions.size > 0 || chains.size > 0 || activeCities.size > 0;
    const scope = scoped ? '目前篩選範圍內' : '全台';
    if (sortMode === 'audio') {
      const top = audioRanked[0];
      if (!top) return null;
      const areaTop = fits[0];
      const areaText = areaTop
        ? `；成像最大仍為 ${areaTop.screen.name}（${areaTop.imageAreaM2.toFixed(0)} ㎡）`
        : '；目前範圍沒有已公布銀幕尺寸的影廳';
      return `${scope}音效層級最高：${top.name}（${AUDIO_TIER_LABELS[top.audioTier]}）${areaText}`;
    }
    if (ranked.length === 0) return null;
    const top = ranked[0];
    const caveat = !top.screen.verified ? '（第 1 名尺寸待驗證）' : '';
    if (sortMode === 'score') {
      const t = scoreMap.get(top.screen.id)?.total ?? 0;
      const tt = Number.isInteger(t) ? t : t.toFixed(1);
      const areaTop = fits[0];
      const extra =
        areaTop && areaTop.screen.id !== top.screen.id
          ? `；成像最大為 ${areaTop.screen.name}（${areaTop.imageAreaM2.toFixed(0)} ㎡）`
          : '';
      return `${scope}綜合評比最高：${top.screen.name}（${tt} 分，口碑分未接入）${extra}${caveat}`;
    }
    const subject = film ? `《${film.title}》` : `${customRatio}:1 畫幅`;
    const base = `${subject}在${scope}，${top.screen.name} 的有效成像最大（${top.imageAreaM2.toFixed(0)} ㎡）`;
    if (ranked.length === 1) return `${base}${caveat}`;
    const times = top.imageAreaM2 / ranked[1].imageAreaM2;
    const cmp =
      times < 1.05
        ? `，與第二名 ${ranked[1].screen.name} 相當`
        : `，是第二名的 ${times.toFixed(1)} 倍`;
    return `${base}${cmp}${caveat}`;
  }, [
    ranked,
    audioRanked,
    fits,
    sortMode,
    scoreMap,
    film,
    customRatio,
    regions,
    chains,
    activeCities,
  ]);

  const toggleSelect = (id: string) => {
    if (!selected.has(id) && selected.size >= 6) {
      showToast('自選比較已達 6 廳上限，請先取消一廳再加入');
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayRanked: Array<FitResult | Screen> =
    sortMode === 'audio'
      ? audioRanked.map((s) => fitMap.get(s.id) ?? s)
      : ranked;

  return (
    <main>
      <header>
        <h1>台灣影廳畫幅模擬器</h1>
        <p className="subtitle">
          同一部片在不同影廳，實際看到的畫面有多大？依畫幅與銀幕尺寸計算有效成像面積。
        </p>
      </header>

      <section className="controls">
        {!controlsOpen && (
          <div className="controls-summary">
            <span>
              {film ? film.title : `${customRatio}:1`} ·{' '}
              {regions.size === 0
                ? '全台'
                : Array.from(regions)
                    .map((r) => REGION_LABELS[r])
                    .join('／')}{' '}
              · {sortMode === 'area' ? '成像面積' : sortMode === 'audio' ? '音效層級' : '綜合評比'}
              {chains.size + activeCities.size > 0 && `（＋${chains.size + activeCities.size} 篩選）`}
            </span>
            <button className="chip" onClick={() => setControlsOpen(true)}>
              修改
            </button>
          </div>
        )}
        {controlsOpen && (
          <>
        <div className="control-group">
          <span className="control-label">片單</span>
          {films.map((f) => (
            <button
              key={f.id}
              className={filmId === f.id ? 'chip active' : 'chip'}
              onClick={() => setFilmId(f.id)}
            >
              {f.title}
            </button>
          ))}
        </div>
        <div className="control-group">
          <span className="control-label">自訂</span>
          <button
            className={film === null ? 'chip active' : 'chip'}
            onClick={() => setFilmId('custom')}
          >
            自訂畫幅
          </button>
          {film === null && (
            <>
              {CUSTOM_RATIOS.map((r) => (
                <button
                  key={r}
                  className={customRatio === r ? 'chip ratio active' : 'chip ratio'}
                  onClick={() => {
                    setCustomRatio(r);
                    setRatioInput(String(r));
                  }}
                >
                  {r}:1
                </button>
              ))}
              <label className="ratio-custom">
                任意
                <input
                  className="ratio-input"
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={4}
                  step={0.01}
                  value={ratioInput}
                  onChange={(e) => {
                    setRatioInput(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v) && v >= 0.5 && v <= 4) setCustomRatio(v);
                  }}
                  onBlur={() => setRatioInput(String(customRatio))}
                  aria-label="自訂畫幅比例（0.5–4）"
                />
                :1
              </label>
            </>
          )}
        </div>
        {film && (
          <div className="control-note">
            <p className="film-meta">
              《{film.title}》{film.titleEn}（{film.year}）
              {film.shotOn && ` ・ ${film.shotOn}`}
              {film.audio && ` ・ ${film.audio}`}
              {film.runtimeMin != null &&
                film.largeFormatMin != null &&
                ` ・ 原生大畫幅 ${film.largeFormatMin}/${film.runtimeMin} 分鐘（${Math.round(
                  (film.largeFormatMin / film.runtimeMin) * 100,
                )}%）`}
              {film.runtimeMin != null && film.largeFormatMin == null && ` ・ 片長 ${film.runtimeMin} 分鐘`}
            </p>
            {film.formatNotes && <p className="film-meta film-format">{film.formatNotes}</p>}
            <SourcesFold sources={film.sources} />
          </div>
        )}
        <div className="control-divider" />
        <div className="control-group">
          <span className="control-label">排序</span>
          <button
            className={sortMode === 'area' ? 'chip active' : 'chip'}
            onClick={() => setSortMode('area')}
          >
            成像面積
          </button>
          <button
            className={sortMode === 'audio' ? 'chip active' : 'chip'}
            onClick={() => setSortMode('audio')}
            title="音效層級優先（Dolby Cinema > DVA > IMAX 12 > Atmos > Auro > IMAX 5 > 7.1 > 5.1），同層級內按面積"
          >
            音效層級
          </button>
          <button
            className={sortMode === 'score' ? 'chip active' : 'chip'}
            onClick={() => setSortMode('score')}
            title="逐項得分卡：格式能力／認證／沉浸音效／投影＋面積名次分，每分附依據"
          >
            綜合評比
          </button>
        </div>
        {sortMode === 'score' && (
          <div className="control-note">
	            <p className="sort-basis">
	              得分卡（本站預設分值，公式透明可調）：可放映 1.43 +1 ・ 杜比影院認證 +1 ・ DVA 授權
	              +0.5 ・ 沉浸音效 +1 ・ 雷射投影 +1（雙機／RGB 再 +0.5）・
	              成像面積比例 0–2（＝2×成像÷範圍內最大成像）・ 放映本片最大畫幅版 +1（1.43 廳不重複計）。
	              未查證項目標「？」不扣分；網友口碑分（0–2）尚未接入。{' '}
	              <a href="#score-method">查看完整評分方式</a>
	            </p>
          </div>
        )}
        {sortMode === 'audio' && (
          <div className="control-note">
            <p className="sort-basis">
              排序依據（本站預設，以沉浸聲場為主軸）：Dolby Cinema ＞ DVA ＞ IMAX 12 聲道 ＞
              Atmos ＞ Auro 11.1 ＞ IMAX 5 聲道 ＞ 7.1 ＞ 5.1——此為認證／系統規格層級，非實測音質；同層級內按成像面積。
            </p>
          </div>
        )}
        <div className="control-divider" />
        <div className="control-group">
          <span className="control-label">品牌</span>
          {MAJOR_CHAINS.map((c) => (
            <button
              key={c}
              className={chains.has(c) ? 'chip active' : 'chip'}
              onClick={() => toggleChain(c)}
            >
              {chains.has(c) ? `✓ ${c}` : c}
            </button>
          ))}
          {MINOR_CHAINS.size > 0 && (
            <button
              className={chains.has(OTHER_CHAINS) ? 'chip active' : 'chip'}
              onClick={() => toggleChain(OTHER_CHAINS)}
              title={`單廳品牌：${Array.from(MINOR_CHAINS).join('、')}`}
            >
              {chains.has(OTHER_CHAINS) ? '✓ 其他' : '其他'}
            </button>
          )}
        </div>
        <div className="control-group">
          <span className="control-label">地區</span>
          {(Object.keys(REGION_LABELS) as Region[]).map((r) => (
            <button
              key={r}
              className={regions.has(r) ? 'chip active' : 'chip'}
              onClick={() => toggleRegion(r)}
            >
              {regions.has(r) ? `✓ ${REGION_LABELS[r]}` : REGION_LABELS[r]}
            </button>
          ))}
        </div>
        {cityOptions.length > 1 && (
          <div className="control-group">
            <span className="control-label">城市</span>
            {cityOptions.map((c) => (
              <button
                key={c}
                className={activeCities.has(c) ? 'chip active' : 'chip'}
                onClick={() => toggleCity(c)}
              >
                {activeCities.has(c) ? `✓ ${c}` : c}
              </button>
            ))}
          </div>
        )}
        <button className="controls-collapse" onClick={() => setControlsOpen(false)}>
          收合條件 ▲
        </button>
          </>
        )}
      </section>

      {insight && <p className="insight">{insight}</p>}

      <OverlayCompare
        fits={fits}
        selected={selectedFits}
        onClear={() => setSelected(new Set())}
        listResorted={sortMode !== 'area'}
      />

      {pool.length === 0 && (
        <p className="empty-state">目前的品牌／地區組合下沒有影廳，請調整篩選條件。</p>
      )}

      {pool.length > 0 && (
        <section className="region-group">
          <h2 className="region-title">
            排名
            <span className="region-count">
              {displayRanked.length} 廳
              {regions.size === 0 && activeCities.size === 0 && chains.size === 0
                ? '（全台）'
                : '（目前篩選範圍）'}
            </span>
            {sortMode === 'audio' && (
              <span
                className="sort-note"
                title="Dolby Cinema ＞ DVA ＞ IMAX 12 ＞ Atmos ＞ Auro ＞ IMAX 5 ＞ 7.1 ＞ 5.1（認證／規格層級，非實測音質）"
              >
                音效層級排序
              </span>
            )}
            {sortMode === 'score' && (
              <span className="sort-note sort-note-score" title="逐項得分卡排序，明細見各卡片">
                綜合評比排序
              </span>
            )}
          </h2>
          <div className="ranking">
            {displayRanked.map((entry, i) => {
              if (!('imageAreaM2' in entry)) {
                return (
                  <UnsizedScreenCard
                    key={entry.id}
                    s={entry}
                    rank={i + 1}
                    audioRanking
                  />
                );
              }
              const fit = entry;
              return (
              <article
                key={fit.screen.id}
                className={selected.has(fit.screen.id) ? 'card selectable selected' : 'card selectable'}
                title="點擊加入／移除疊圖比較"
                role="button"
                tabIndex={0}
	                aria-pressed={selected.has(fit.screen.id)}
	                onClick={(e) => {
	                  if ((e.target as HTMLElement).closest('a, button, input, details, summary')) return;
	                  toggleSelect(fit.screen.id);
	                }}
	                onKeyDown={(e) => {
	                  if (e.key !== 'Enter' && e.key !== ' ') return;
	                  if ((e.target as HTMLElement).closest('a, button, input, details, summary')) return;
                  e.preventDefault();
                  toggleSelect(fit.screen.id);
                }}
              >
	                <div className={sortMode === 'audio' ? 'rank rank-audio' : 'rank'}>{i + 1}</div>
	                <div className="card-body">
	                  <h3>
	                    {fit.screen.name}
	                    <button
	                      type="button"
	                      className={
	                        selected.has(fit.screen.id) ? 'compare-pill on' : 'compare-pill'
	                      }
	                      aria-pressed={selected.has(fit.screen.id)}
	                      onClick={(e) => {
	                        e.stopPropagation();
	                        toggleSelect(fit.screen.id);
	                      }}
	                    >
	                      {selected.has(fit.screen.id) ? '✓ 比較中' : '＋比較'}
	                    </button>
	                  </h3>
	                  <p className="key-takeaway">
	                    {fit.version.label}
	                    {fit.versionFallback &&
	                      fit.screen.hallCategory !== 'PREMIUM' &&
	                      fit.screen.hallCategory !== 'STANDARD' &&
	                      '；本片無此廳型專屬版本'}
	                    {fit.versionUncertain && '；實際版本依影城排映'}
	                  </p>
	                  <p className="meta">
	                    <CityLink s={fit.screen} /> ・{' '}
	                    {fit.screen.priceNTD != null && (
	                      <span className="price" title={fit.screen.priceNotes ?? '全票價僅供參考，不計入排序'}>
	                        全票 {fit.screen.priceNTD} 元 ・{' '}
	                      </span>
	                    )}
	                    {fit.screen.priceNTD == null && <span className="price">票價待確認 ・ </span>}
	                    <a href={fit.screen.booking} target="_blank" rel="noreferrer">
	                      查場次
	                    </a>
	                  </p>
	                  <details className="evidence-fold">
	                    <summary>規格與依據</summary>
	                    <dl className="spec-grid">
	                      <SpecField label="廳型">{hallTypeLabel(fit.screen)}</SpecField>
	                      <SpecField label="投影">{fit.screen.projection ?? '未公布'}</SpecField>
	                      <SpecField
	                        label="音效"
	                        className={fit.screen.audioTier === 'SURROUND_5_1' ? 'spec-unknown' : ''}
	                      >
	                        {AUDIO_TIER_LABELS[fit.screen.audioTier]}
	                        {fit.screen.audio && `（${fit.screen.audio}）`}
	                      </SpecField>
	                    </dl>
	                    <p className="dims">
	                      銀幕 {fit.screen.widthM}×{fit.screen.heightM}m ・ 成像{' '}
	                      {fit.imageWidthM.toFixed(1)}×{fit.imageHeightM.toFixed(1)}m ・ 銀幕利用率{' '}
	                      {(fit.screenUsage * 100).toFixed(0)}%
	                    </p>
	                    <p className="evidence-note">
	                      版本：{fit.version.label}
	                      {fit.versionFallback &&
	                        fit.screen.hallCategory !== 'PREMIUM' &&
	                        fit.screen.hallCategory !== 'STANDARD' &&
	                        '（本片無此廳型專屬版本）'}
	                      {fit.versionUncertain && '（此廳排映版本依影城而定，以較大者計）'}
	                      {fit.version.confidence === 'reported' && '（畫幅為媒體報導值）'}
	                      {fit.version.confidence === 'expected' && '（畫幅未定，此為預期值）'}
	                    </p>
	                    <p className="evidence-note">
	                      查證狀態：
	                      {fit.screen.verified ? '銀幕尺寸已查證' : '銀幕尺寸待驗證'}
	                      {fit.screen.notes && ` ・ ${fit.screen.notes}`}
	                    </p>
	                    {sortMode === 'score' && scoreMap.get(fit.screen.id) && (
	                      <div className="score-breakdown">
	                        <div className="score-breakdown-head">
	                          <strong>綜合評比分項</strong>
	                          <a href="#score-method">評分方式</a>
	                        </div>
	                        <ul>
	                          {scoreMap.get(fit.screen.id)!.items.map((it) => (
	                            <li key={it.label}>
	                              <span>{it.label}</span>
	                              <span className={it.unknown ? 'score-unknown' : 'score-points'}>
	                                {it.unknown ? '待確認' : it.pts > 0 ? `+${it.pts}` : '不加分'}
	                              </span>
	                            </li>
	                          ))}
	                        </ul>
	                      </div>
	                    )}
	                    {(fit.screen.bestRows || fit.screen.communityNotes) && (
	                      <p className="community-line">
	                        {fit.screen.bestRows && <strong>💺 推薦座位 {fit.screen.bestRows}</strong>}
	                        {fit.screen.bestRows && fit.screen.communityNotes && ' ・ '}
	                        {fit.screen.communityNotes}
	                      </p>
	                    )}
	                    <SourcesFold sources={fit.screen.sources} />
	                  </details>
	                </div>
                {sortMode === 'score' ? (
                  <div className="card-area" title="綜合得分（口碑分尚未接入）">
                    {(() => {
                      const t = scoreMap.get(fit.screen.id)?.total ?? 0;
                      return Number.isInteger(t) ? t : t.toFixed(1);
                    })()}
                    <span className="unit">分</span>
                  </div>
                ) : sortMode === 'audio' ? (
                  <div
                    className="card-area card-area-audio"
                    title="音效層級序位（8＝最高；認證／規格層級排序，非實測音質；未查證顯示？）"
                  >
                    {fit.screen.audioTier === 'SURROUND_5_1' ? (
                      '？'
                    ) : (
                      <>
                        {AUDIO_TIER_ORDER.length - AUDIO_TIER_ORDER.indexOf(fit.screen.audioTier)}
                        <span className="unit">／8 級</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="card-area" title="有效成像面積">
                    {fit.imageAreaM2.toFixed(0)}
                    <span className="unit">㎡</span>
                  </div>
                )}
              </article>
              );
            })}
            {unsized.length > 0 && (
              <details className="unsized-fold">
                <summary>資料徵集中：{unsized.length} 廳尚無銀幕尺寸</summary>
                <p className="unsized-cta">
                  知道這些廳的官方尺寸或丈量數據嗎？歡迎到{' '}
                  <a
                    href="https://github.com/cowton0627/taiwan-theater/issues"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub issue
                  </a>{' '}
                  提供來源。
                </p>
                {unsized.map((s) => (
                  <UnsizedScreenCard key={s.id} s={s} />
                ))}
              </details>
            )}
          </div>
        </section>
      )}

      <section className="method" id="method">
        <h2 className="region-title">資料來源與方法</h2>
        <ul className="method-list">
          <li>收錄準則：只收商業影廳的特殊廳（IMAX／杜比影院／DVA／LUXE／巨幕／ScreenX／代表性 Atmos 廳）；歇業廳保留紀錄不顯示。</li>
          <li>計算方式：以「畫幅投影在銀幕上的最大內接矩形」求有效成像面積；一般廳同時發行兩版時取較大者並標註不確定性。</li>
          <li>來源優先序：官方（官網／官方文件）＞ 2025 後媒體 ＞ 論壇整理與實測；每筆資料附來源，點各卡片「資料來源與查證」可見。</li>
          <li>查證原則：尺寸經官方公布或丈量才標已驗證；查不到的音效標「音效未查證」、不硬填；來源衝突並列各說法不隱藏。</li>
          <li>票價為平日 2D 全票參考值（含查價時點），不計入任何排序。</li>
	          <li id="score-method">
	            評分方式：綜合評比由格式能力、認證、沉浸音效、投影、目前範圍內的成像面積比例與本片版本逐項加總；未知資料標「待確認」且不視為較差，相關能力不重複計分，口碑分尚未接入。各卡展開「規格與依據」可看實際加分與來源；分數是本站透明的決策輔助，不是實測音質。
	          </li>
        </ul>
      </section>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <footer>
        <p>
          本站不含即時場次——各廳是否排映特定影片與格式，請以影城官網為準。
          <a href="#method">資料來源與方法</a>。
          銀幕尺寸為社群流傳資料、尚待逐廳查證；歡迎透過 GitHub issue 提供丈量或官方來源。
          比較方法啟發自{' '}
          <a href="https://github.com/rexx/theater-screen-size-2" target="_blank" rel="noreferrer">
            rexx/theater-screen-size-2
          </a>
          。
        </p>
      </footer>
    </main>
  );
}
