import { useMemo, useState } from 'react';
import screensData from './data/screens.json';
import filmsData from './data/films.json';
import { customVersion, fitFilm, fitImage } from './lib/fit';
import type { Film, FitResult, HallCategory, Region, Screen } from './types';

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

/** 每列的迷你示意圖：銀幕外框 + 實際成像區 */
function MiniScreen({ fit }: { fit: FitResult }) {
  const maxW = 120;
  const maxH = 64;
  const scale = Math.min(maxW / fit.screen.widthM, maxH / fit.screen.heightM);
  const sw = fit.screen.widthM * scale;
  const sh = fit.screen.heightM * scale;
  const iw = fit.imageWidthM * scale;
  const ih = fit.imageHeightM * scale;
  return (
    <svg width={maxW} height={maxH} viewBox={`0 0 ${maxW} ${maxH}`} aria-hidden>
      <rect
        x={(maxW - sw) / 2}
        y={(maxH - sh) / 2}
        width={sw}
        height={sh}
        className="mini-screen"
      />
      <rect
        x={(maxW - iw) / 2}
        y={(maxH - ih) / 2}
        width={iw}
        height={ih}
        className="mini-image"
      />
    </svg>
  );
}

/** 疊圖比較：把前幾名影廳的成像框以同一公尺比例尺置中疊放，可收合 */
function OverlayCompare({ fits }: { fits: FitResult[] }) {
  const [open, setOpen] = useState(true);
  const top = fits.slice(0, 6);
  if (top.length === 0) return null;
  const maxWm = Math.max(...top.map((f) => f.imageWidthM));
  const maxHm = Math.max(...top.map((f) => f.imageHeightM));
  const width = 720;
  const scale = width / (maxWm * 1.06);
  const height = maxHm * scale * 1.12;
  return (
    <section className="overlay-section">
      <button
        className="overlay-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={open ? 'caret open' : 'caret'}>▸</span>
        疊圖比較（前 {top.length} 名成像，同比例尺）
      </button>
      {open && (
        <>
          <svg
            className="overlay"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="影廳成像大小疊圖比較"
          >
            {top.map((f, i) => {
              const w = f.imageWidthM * scale;
              const h = f.imageHeightM * scale;
              return (
                <rect
                  key={f.screen.id}
                  x={(width - w) / 2}
                  y={height - h - 4}
                  width={w}
                  height={h}
                  className={`overlay-rect overlay-rect-${i}`}
                />
              );
            })}
          </svg>
          <ul className="overlay-legend">
            {top.map((f, i) => (
              <li key={f.screen.id}>
                <span className={`swatch swatch-${i}`} />
                {i + 1}. {f.screen.name}
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

  const film = films.find((f) => f.id === filmId) ?? null;

  const fits = useMemo(() => {
    const pool =
      regions.size === 0 ? screens : screens.filter((s) => regions.has(s.region));
    const results = pool
      .map((s) =>
        film
          ? fitFilm(s, film)
          : { ...fitImage(s, customVersion(customRatio)), versionUncertain: false },
      )
      .filter((r): r is FitResult => r !== null);
    results.sort((a, b) => b.imageAreaM2 - a.imageAreaM2);
    return results;
  }, [film, customRatio, regions]);

  const maxArea = fits[0]?.imageAreaM2 ?? 1;

  /** 依地區分組（固定北→中→南→東順序），區內維持成像面積排序 */
  const grouped = useMemo(
    () =>
      (Object.keys(REGION_LABELS) as Region[])
        .map((r) => ({ region: r, fits: fits.filter((f) => f.screen.region === r) }))
        .filter((g) => g.fits.length > 0),
    [fits],
  );

  const toggleRegion = (r: Region) => {
    setRegions((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
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

      <OverlayCompare fits={fits} />

      {grouped.map((group) => (
        <section key={group.region} className="region-group">
          <h2 className="region-title">
            {REGION_LABELS[group.region]}
            <span className="region-count">{group.fits.length} 廳</span>
          </h2>
          <div className="ranking">
            {group.fits.map((fit, i) => (
              <article key={fit.screen.id} className="card">
                <div className="rank">{i + 1}</div>
                <MiniScreen fit={fit} />
                <div className="card-body">
                  <h3>
                    {fit.screen.name}
                    <span className="badge">{CATEGORY_LABELS[fit.screen.hallCategory]}</span>
                    {fit.screen.atmos && <span className="badge atmos">Atmos</span>}
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
          </div>
        </section>
      ))}

      <footer>
        <p>
          銀幕尺寸為社群流傳資料、尚待逐廳查證；歡迎透過 GitHub issue 提供丈量或官方來源。
          畫幅資訊參考 Threads @moviekitaoji；比較方法啟發自 rexx/theater-screen-size-2。
        </p>
      </footer>
    </main>
  );
}
