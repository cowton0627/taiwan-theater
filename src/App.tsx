import { useMemo, useState } from 'react';
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

/** 音效層級徽章；與 hallCategory／brandLabel 重複時不重掛 */
function AudioTierBadge({ s }: { s: Screen }) {
  if (s.audioTier === 'DOLBY_CINEMA' && s.hallCategory === 'DOLBY_CINEMA') return null;
  if (s.audioTier === 'DVA' && s.brandLabel === 'DVA') return null;
  return (
    <span className={`badge ${AUDIO_TIER_CLASS[s.audioTier]}`} title={s.audio}>
      {AUDIO_TIER_LABELS[s.audioTier]}
    </span>
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
}: {
  fits: FitResult[];
  selected: FitResult[];
  onClear: () => void;
}) {
  const [open, setOpen] = useState(true);
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
          <span className="overlay-hint">點下方卡片可自選比較（最多 6 廳）</span>
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
              // 同尺寸的第 2 框起改用虛線並錯開起點，讓每廳顏色都可見
              const sizeSeen = new Map<string, number>();
              return top.map((f, i) => {
                const w = f.imageWidthM * scale;
                const h = f.imageHeightM * scale;
                const key = `${f.imageWidthM.toFixed(2)}x${f.imageHeightM.toFixed(2)}`;
                const dup = sizeSeen.get(key) ?? 0;
                sizeSeen.set(key, dup + 1);
                return (
                  <rect
                    key={f.screen.id}
                    x={(width - w) / 2}
                    y={(height - h) / 2}
                    width={w}
                    height={h}
                    className={`overlay-rect overlay-rect-${i}`}
                    strokeDasharray={dup > 0 ? '10 10' : undefined}
                    strokeDashoffset={dup > 0 ? dup * 10 : undefined}
                  />
                );
              });
            })()}
          </svg>
          <ul className="overlay-legend">
            {top.map((f, i) => (
              <li key={f.screen.id}>
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
  const [filmId, setFilmId] = useState<string>(films[0]?.id ?? 'custom');
  const [customRatio, setCustomRatio] = useState<number>(2.39);
  const [regions, setRegions] = useState<Set<Region>>(new Set());
  /** 自選比較的影廳 id；空集合＝疊圖顯示預設前 6 名 */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** 排序：成像面積（預設）或音效層級優先（同層級內仍按面積） */
  const [sortMode, setSortMode] = useState<'area' | 'audio'>('area');

  const film = films.find((f) => f.id === filmId) ?? null;

  const pool = useMemo(
    () =>
      screens
        .filter((s) => s.status === 'operating')
        .filter((s) => regions.size === 0 || regions.has(s.region)),
    [regions],
  );

  const fits = useMemo(() => {
    const results = pool
      .filter(isSized)
      .map((s) =>
        film
          ? fitFilm(s, film)
          : { ...fitImage(s, customVersion(customRatio)), versionUncertain: false },
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

  /** 依成像面積排序的自選比較清單（跨區也可比） */
  const selectedFits = useMemo(
    () => fits.filter((f) => selected.has(f.screen.id)),
    [fits, selected],
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 6) next.add(id);
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
          {film === null &&
            CUSTOM_RATIOS.map((r) => (
              <button
                key={r}
                className={customRatio === r ? 'chip ratio active' : 'chip ratio'}
                onClick={() => setCustomRatio(r)}
              >
                {r}:1
              </button>
            ))}
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
        {film && (
          <p className="film-meta">
            《{film.title}》{film.titleEn}（{film.year}）
            {film.shotOn && ` ・ ${film.shotOn}`}
            {film.audio && ` ・ ${film.audio}`}
          </p>
        )}
      </section>

      <OverlayCompare
        fits={fits}
        selected={selectedFits}
        onClear={() => setSelected(new Set())}
      />

      {grouped.map((group) => (
        <section key={group.region} className="region-group">
          <h2 className="region-title">
            {REGION_LABELS[group.region]}
            <span className="region-count">
              {group.fits.length} 廳
              {group.unsized.length > 0 && `（另 ${group.unsized.length} 廳尺寸未公布）`}
            </span>
          </h2>
          <div className="ranking">
            {group.fits.map((fit, i) => (
              <article
                key={fit.screen.id}
                className={selected.has(fit.screen.id) ? 'card selectable selected' : 'card selectable'}
                title="點擊加入／移除疊圖比較"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a')) return;
                  toggleSelect(fit.screen.id);
                }}
              >
                <div className="rank">{i + 1}</div>
                <div className="card-body">
                  <h3>
                    {fit.screen.name}
                    <span className="badge">{CATEGORY_LABELS[fit.screen.hallCategory]}</span>
                    {fit.screen.brandLabel && (
                      <span className="badge brand">{fit.screen.brandLabel}</span>
                    )}
                    {fit.screen.projection && (
                      <span className="badge">{fit.screen.projection}</span>
                    )}
                    <AudioTierBadge s={fit.screen} />
                    {!fit.screen.verified && (
                      <span className="badge unverified" title="尺寸為社群流傳值，尚未查證">
                        待驗證
                      </span>
                    )}
                  </h3>
                  <p className="dims">
                    {fit.version.label}
                    {fit.versionUncertain && '（此廳排映版本依影城而定，以較大者計）'}
                    ・ 銀幕 {fit.screen.widthM}×{fit.screen.heightM}m ・ 成像{' '}
                    {fit.imageWidthM.toFixed(1)}×{fit.imageHeightM.toFixed(1)}m ={' '}
                    <strong>{fit.imageAreaM2.toFixed(0)} ㎡</strong>（銀幕利用率{' '}
                    {(fit.screenUsage * 100).toFixed(0)}%）
                  </p>
                  <div className="bar-track">
                    <div
                      className="bar"
                      style={{ width: `${(fit.imageAreaM2 / maxArea) * 100}%` }}
                    />
                  </div>
                  <p className="meta">
                    {fit.screen.chain} ・ {fit.screen.city} ・{' '}
                    <a href={fit.screen.booking} target="_blank" rel="noreferrer">
                      查場次
                    </a>
                    {fit.screen.notes && ` ・ ${fit.screen.notes}`}
                  </p>
                </div>
              </article>
            ))}
            {group.unsized.map((s) => (
              <article key={s.id} className="card card-unsized">
                <div className="rank">–</div>
                <div className="card-body">
                  <h3>
                    {s.name}
                    <span className="badge">{CATEGORY_LABELS[s.hallCategory]}</span>
                    {s.brandLabel && <span className="badge brand">{s.brandLabel}</span>}
                    {s.projection && <span className="badge">{s.projection}</span>}
                    <AudioTierBadge s={s} />
                    <span className="badge unverified">尺寸未公布</span>
                  </h3>
                  <p className="meta">
                    未納入成像排名 ・ {s.chain} ・ {s.city} ・{' '}
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

      <footer>
        <p>
          銀幕尺寸為社群流傳資料、尚待逐廳查證；歡迎透過 GitHub issue 提供丈量或官方來源。
          比較方法啟發自 rexx/theater-screen-size-2。
        </p>
      </footer>
    </main>
  );
}
