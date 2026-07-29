import { useEffect, useMemo, useRef, useState } from 'react';
import screensData from './data/screens.json';
import filmsData from './data/films.json';
import { customVersion, fitFilm, fitImage } from './lib/fit';
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

const AUDIO_TIER_CLASS: Record<AudioTier, string> = {
  DOLBY_CINEMA: 'tier-cert',
  DVA: 'tier-cert',
  IMAX_12CH: 'tier-imax',
  IMAX_5CH: 'tier-imax',
  ATMOS: 'tier-atmos',
  AURO_11_1: 'tier-atmos',
  SURROUND_7_1: 'tier-basic',
  SURROUND_5_1: 'tier-unknown',
};

/**
 * 音效層級徽章；與 hallCategory／brandLabel 重複時不重掛
 * （該情況由 categoryBadgeClass／brandBadgeClass 把既有徽章染成認證綠）
 */
function AudioTierBadge({ s }: { s: Screen }) {
  if (s.audioTier === 'DOLBY_CINEMA' && s.hallCategory === 'DOLBY_CINEMA') return null;
  if (s.audioTier === 'DVA' && s.brandLabel === 'DVA') return null;
  return (
    <span className={`badge ${AUDIO_TIER_CLASS[s.audioTier]}`} title={s.audio}>
      {AUDIO_TIER_LABELS[s.audioTier]}
    </span>
  );
}

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

/** 杜比影院類別徽章＝整廳認證，染認證綠 */
function categoryBadgeClass(s: Screen) {
  return s.hallCategory === 'DOLBY_CINEMA' ? 'badge tier-cert' : 'badge';
}

/** DVA 品牌徽章＝認證級授權，染認證綠；其餘維持品牌金 */
function brandBadgeClass(s: Screen) {
  return s.brandLabel === 'DVA' || s.brandLabel === 'Dolby Cinema'
    ? 'badge brand tier-cert'
    : 'badge brand';
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
  audioSorted,
}: {
  fits: FitResult[];
  selected: FitResult[];
  onClear: () => void;
  /** 下方列表正以音效層級排序——疊圖需自我聲明不隨之變動 */
  audioSorted: boolean;
}) {
  const [open, setOpen] = useState(true);
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
            {audioSorted
              ? '疊圖固定顯示面積前 6，不隨音效排序變動'
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
                return (
                  <g key={f.screen.id} className={`overlay-item${stateClass}`}>
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
  /** 排序：成像面積（預設）或音效層級優先（同層級內仍按面積） */
  const [sortMode, setSortMode] = useState<'area' | 'audio'>(
    INIT_PARAMS.get('sort') === 'audio' ? 'audio' : 'area',
  );

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

  /** 已選地區內的城市選項（依廳數排序）；未選地區時不展開城市層 */
  const cityOptions = useMemo(() => {
    if (regions.size === 0) return [];
    const counts = new Map<string, number>();
    for (const s of screens) {
      if (s.status !== 'operating' || !regions.has(s.region)) continue;
      counts.set(s.city, (counts.get(s.city) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'))
      .map(([c]) => c);
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

  /** 排名列表的顯示順序；疊圖不受排序模式影響、永遠按面積取前 6 */
  const ranked = useMemo(() => {
    if (sortMode === 'area') return fits;
    return [...fits].sort((a, b) => {
      const tierDiff =
        AUDIO_TIER_ORDER.indexOf(a.screen.audioTier) -
        AUDIO_TIER_ORDER.indexOf(b.screen.audioTier);
      return tierDiff !== 0 ? tierDiff : b.imageAreaM2 - a.imageAreaM2;
    });
  }, [fits, sortMode]);

  const maxArea = fits[0]?.imageAreaM2 ?? 1;

  /** 依地區分組（固定北→中→南→東順序）；區內排名 + 尺寸未公布清單 */
  const grouped = useMemo(
    () =>
      (Object.keys(REGION_LABELS) as Region[])
        .map((r) => ({
          region: r,
          fits: ranked.filter((f) => f.screen.region === r),
          unsized: pool.filter((s) => s.region === r && !isSized(s)),
        }))
        .filter((g) => g.fits.length > 0 || g.unsized.length > 0),
    [ranked, pool],
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

  return (
    <main>
      <header>
        <h1>台灣影廳畫幅模擬器</h1>
        <p className="subtitle">
          同一部片在不同影廳，實際看到的畫面有多大？依畫幅與銀幕尺寸計算有效成像面積。
        </p>
      </header>

      <section className="controls">
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
          </div>
        )}
        <div className="control-group">
          <span className="control-label">品牌</span>
          {MAJOR_CHAINS.map((c) => (
            <button
              key={c}
              className={chains.has(c) ? 'chip active' : 'chip'}
              onClick={() => toggleChain(c)}
            >
              {c}
            </button>
          ))}
          {MINOR_CHAINS.size > 0 && (
            <button
              className={chains.has(OTHER_CHAINS) ? 'chip active' : 'chip'}
              onClick={() => toggleChain(OTHER_CHAINS)}
              title={`單廳品牌：${Array.from(MINOR_CHAINS).join('、')}`}
            >
              其他
            </button>
          )}
        </div>
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
            title="音效層級優先（Dolby Cinema > DVA > IMAX 12 > IMAX 5 > Atmos > 7.1 > 5.1），同層級內按面積"
          >
            音效層級
          </button>
        </div>
        {sortMode === 'audio' && (
          <div className="control-note">
            <p className="sort-basis">
              排序依據（本站預設）：Dolby Cinema ＞ DVA ＞ IMAX 12 聲道 ＞ IMAX 5 聲道 ＞ Atmos ＞
              7.1 ＞ 5.1——此為認證／系統規格層級，非實測音質；同層級內按成像面積。
            </p>
          </div>
        )}
        <div className="control-group">
          <span className="control-label">地區</span>
          {(Object.keys(REGION_LABELS) as Region[]).map((r) => (
            <button
              key={r}
              className={regions.has(r) ? 'chip active' : 'chip'}
              onClick={() => toggleRegion(r)}
            >
              {REGION_LABELS[r]}
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
                {c}
              </button>
            ))}
          </div>
        )}
      </section>

      <OverlayCompare
        fits={fits}
        selected={selectedFits}
        onClear={() => setSelected(new Set())}
        audioSorted={sortMode === 'audio'}
      />

      {grouped.length === 0 && (
        <p className="empty-state">目前的品牌／地區組合下沒有影廳，請調整篩選條件。</p>
      )}

      {grouped.length > 0 && (
        <p className="badge-legend">
          徽章色：<span className="lg-cert">綠＝整廳認證級</span> ・{' '}
          <span className="lg-imax">藍＝沉浸音效／IMAX 聲道</span> ・{' '}
          <span className="lg-brand">金＝廳品牌</span> ・{' '}
          <span className="lg-basic">灰＝基本聲道</span> ・{' '}
          <span className="lg-unknown">虛線＝音效未查證</span>
        </p>
      )}

      {grouped.map((group) => (
        <section key={group.region} className="region-group">
          <h2 className="region-title">
            {REGION_LABELS[group.region]}
            <span className="region-count">
              {group.fits.length} 廳
              {group.unsized.length > 0 && `（另 ${group.unsized.length} 廳尺寸未公布）`}
            </span>
            {sortMode === 'audio' && (
              <span
                className="sort-note"
                title="Dolby Cinema ＞ DVA ＞ IMAX 12 ＞ IMAX 5 ＞ Atmos ＞ 7.1 ＞ 5.1（認證／規格層級，非實測音質）"
              >
                音效層級排序
              </span>
            )}
          </h2>
          <div className="ranking">
            {group.fits.map((fit, i) => (
              <article
                key={fit.screen.id}
                className={selected.has(fit.screen.id) ? 'card selectable selected' : 'card selectable'}
                title="點擊加入／移除疊圖比較"
                role="button"
                tabIndex={0}
                aria-pressed={selected.has(fit.screen.id)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a')) return;
                  toggleSelect(fit.screen.id);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  if ((e.target as HTMLElement).closest('a')) return;
                  e.preventDefault();
                  toggleSelect(fit.screen.id);
                }}
              >
                <div className={sortMode === 'audio' ? 'rank rank-audio' : 'rank'}>{i + 1}</div>
                <div className="card-body">
                  <h3>
                    {fit.screen.name}
                    <span className={categoryBadgeClass(fit.screen)}>
                      {CATEGORY_LABELS[fit.screen.hallCategory]}
                    </span>
                    {fit.screen.brandLabel && (
                      <span className={brandBadgeClass(fit.screen)}>{fit.screen.brandLabel}</span>
                    )}
                    {fit.screen.projection && (
                      <span className="badge">{fit.screen.projection}</span>
                    )}
                    <AudioTierBadge s={fit.screen} />
                  </h3>
                  <p className="dims">
                    {fit.version.label}
                    {fit.versionFallback &&
                      fit.screen.hallCategory !== 'PREMIUM' &&
                      fit.screen.hallCategory !== 'STANDARD' &&
                      '（本片無此廳型專屬版本）'}
                    {fit.versionUncertain && '（此廳排映版本依影城而定，以較大者計）'}
                    {fit.version.confidence === 'reported' && '（畫幅為媒體報導值）'}
                    {fit.version.confidence === 'expected' && '（畫幅未定，此為預期值）'}
                    ・ 銀幕 {fit.screen.widthM}×{fit.screen.heightM}m ・ 成像{' '}
                    {fit.imageWidthM.toFixed(1)}×{fit.imageHeightM.toFixed(1)}m（利用率{' '}
                    {(fit.screenUsage * 100).toFixed(0)}%）
                    {!fit.screen.verified && (
                      <span className="unverified-note" title="尺寸為社群流傳值，尚未查證">
                        {' '}
                        ・尺寸待驗證
                      </span>
                    )}
                  </p>
                  <div className="bar-track">
                    <div
                      className="bar"
                      style={{ width: `${(fit.imageAreaM2 / maxArea) * 100}%` }}
                    />
                  </div>
                  <p className="meta">
                    {fit.screen.chain} ・ <CityLink s={fit.screen} /> ・{' '}
                    <a href={fit.screen.booking} target="_blank" rel="noreferrer">
                      查場次
                    </a>
                    {fit.screen.notes && ` ・ ${fit.screen.notes}`}
                  </p>
                </div>
                <div className="card-area" title="有效成像面積">
                  {fit.imageAreaM2.toFixed(0)}
                  <span className="unit">㎡</span>
                </div>
              </article>
            ))}
            {group.unsized.map((s) => (
              <article key={s.id} className="card card-unsized">
                <div className="rank">–</div>
                <div className="card-body">
                  <h3>
                    {s.name}
                    <span className={categoryBadgeClass(s)}>{CATEGORY_LABELS[s.hallCategory]}</span>
                    {s.brandLabel && <span className={brandBadgeClass(s)}>{s.brandLabel}</span>}
                    {s.projection && <span className="badge">{s.projection}</span>}
                    <AudioTierBadge s={s} />
                    <span className="badge unverified">尺寸未公布</span>
                  </h3>
                  <p className="meta">
                    未納入成像排名 ・ {s.chain} ・ <CityLink s={s} /> ・{' '}
                    <a href={s.booking} target="_blank" rel="noreferrer">
                      查場次
                    </a>
                    {s.notes && ` ・ ${s.notes}`}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <footer>
        <p>
          本站不含即時場次——各廳是否排映特定影片與格式，請以影城官網為準。
          銀幕尺寸為社群流傳資料、尚待逐廳查證；歡迎透過 GitHub issue 提供丈量或官方來源。
          比較方法啟發自 rexx/theater-screen-size-2。
        </p>
      </footer>
    </main>
  );
}
