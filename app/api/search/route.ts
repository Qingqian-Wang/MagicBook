// /api/search：Agent 的联网搜索代理。服务端代发请求并解析结果，
// 这样浏览器侧不暴露任何 key，且能规避浏览器 CORS。
//
// demo 默认用无需 key 的 Bing 网页搜索结果（国内网络可达、零配置即可用）。
// 若要换其它 provider（DuckDuckGo / Tavily / SerpAPI / Brave…），改这里的抓取与解析即可，Agent 侧无感。
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;|&ensp;|&emsp;|&thinsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
}

interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

/** 解析 Bing 自然结果（<li class="b_algo">…</li> 块） */
function parseBing(html: string, n: number): WebResult[] {
  const blocks = [...html.matchAll(/<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)];
  const out: WebResult[] = [];
  for (const b of blocks.slice(0, n)) {
    const body = b[1];
    const ah = body.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!ah) continue;
    let title = decodeEntities(strip(ah[2]));
    // Bing 会把站点文本拼在标题末尾，截掉可见 scheme 之后的部分
    const cut = title.search(/https?:\/\//);
    if (cut > 0) title = title.slice(0, cut).trim();
    if (!title) continue;
    const p = body.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const snippet = p ? decodeEntities(strip(p[1])).slice(0, 400) : "";
    out.push({ title, url: ah[1], snippet });
  }
  return out;
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "missing query" }, { status: 400 });
  const n = clamp(Number.parseInt(searchParams.get("n") ?? "5", 10) || 5, 1, 10);

  const base = (process.env.SEARCH_BING_HOST ?? "https://cn.bing.com").replace(/\/+$/, "");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${base}/search?q=${encodeURIComponent(q)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    }
    const results = parseBing(await res.text(), n);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "search upstream error or timeout" }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
