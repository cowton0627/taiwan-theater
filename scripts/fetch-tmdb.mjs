/**
 * 階段二：從 TMDB 抓台灣上映中／即將上映片單，寫入 public/data/tmdb.json。
 * 供 GitHub Actions 每日執行；畫幅資料 TMDB 沒有，仍由 src/data/films.json 手工維護。
 *
 * 用法：TMDB_TOKEN=<v4 read access token> node scripts/fetch-tmdb.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';

const token = process.env.TMDB_TOKEN;
if (!token) {
  console.error('缺少 TMDB_TOKEN 環境變數（TMDB v4 Read Access Token）');
  process.exit(1);
}

const BASE = 'https://api.themoviedb.org/3';
const PARAMS = 'region=TW&language=zh-TW&page=1';

async function get(path) {
  const res = await fetch(`${BASE}${path}?${PARAMS}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`TMDB ${path} 回應 ${res.status}`);
  return res.json();
}

const [nowPlaying, upcoming] = await Promise.all([
  get('/movie/now_playing'),
  get('/movie/upcoming'),
]);

const pick = (m) => ({
  tmdbId: m.id,
  title: m.title,
  originalTitle: m.original_title,
  releaseDate: m.release_date,
  poster: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
});

await mkdir('public/data', { recursive: true });
await writeFile(
  'public/data/tmdb.json',
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      nowPlaying: nowPlaying.results.map(pick),
      upcoming: upcoming.results.map(pick),
    },
    null,
    2,
  ),
);

console.log(
  `已寫入 public/data/tmdb.json：上映中 ${nowPlaying.results.length} 部、即將上映 ${upcoming.results.length} 部`,
);
