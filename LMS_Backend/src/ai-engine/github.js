/**
 * Best-effort fetch of a public GitHub repository's source for AI review.
 * Uses the public REST API (optionally authenticated with GITHUB_TOKEN to lift
 * rate limits). Returns a concatenated, size-bounded snapshot of source files.
 */

const SOURCE_EXT = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rb', 'php', 'cs', 'cpp', 'c', 'h',
  'rs', 'kt', 'swift', 'scala', 'sql', 'sh', 'json', 'yaml', 'yml', 'md', 'html',
  'css', 'vue', 'svelte',
]);
const SKIP_DIR = /(^|\/)(node_modules|dist|build|\.git|vendor|\.next|coverage|__pycache__|\.venv)(\/|$)/;
const MAX_FILES = 40;
const MAX_TOTAL_BYTES = 180_000; // ~45K tokens of source budget
const MAX_FILE_BYTES = 24_000;

/** Parse owner/repo from common GitHub URL forms. */
export function parseRepoUrl(url) {
  const m = String(url)
    .trim()
    .match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?].*)?$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

function ghHeaders(token) {
  const h = { Accept: 'application/vnd.github+json', 'User-Agent': 'lms-ai-engine' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghJson(url, token) {
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${url}${res.status === 403 ? ' (rate limited — set GITHUB_TOKEN)' : ''}`);
  }
  return res.json();
}

/**
 * @returns {Promise<{ owner, repo, defaultBranch, description, fileCount, truncated, content }>}
 */
export async function fetchRepoSnapshot(repoUrl, { token } = {}) {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) throw new Error('Not a valid GitHub repository URL');
  const { owner, repo } = parsed;

  const meta = await ghJson(`https://api.github.com/repos/${owner}/${repo}`, token);
  const branch = meta.default_branch || 'main';

  const tree = await ghJson(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    token,
  );

  const candidates = (tree.tree || [])
    .filter((n) => n.type === 'blob' && !SKIP_DIR.test(n.path))
    .filter((n) => {
      const ext = n.path.split('.').pop()?.toLowerCase();
      return ext && SOURCE_EXT.has(ext) && (n.size ?? 0) <= MAX_FILE_BYTES;
    })
    // Prefer README + shallow files first.
    .sort((a, b) => {
      const ra = /readme/i.test(a.path) ? -1 : a.path.split('/').length;
      const rb = /readme/i.test(b.path) ? -1 : b.path.split('/').length;
      return ra - rb;
    })
    .slice(0, MAX_FILES);

  let total = 0;
  let truncated = tree.truncated || candidates.length < (tree.tree || []).length;
  const parts = [];
  let included = 0;

  for (const node of candidates) {
    if (total >= MAX_TOTAL_BYTES) {
      truncated = true;
      break;
    }
    try {
      const raw = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${node.path}`,
        { headers: { 'User-Agent': 'lms-ai-engine' } },
      );
      if (!raw.ok) continue;
      let text = await raw.text();
      if (text.length > MAX_FILE_BYTES) {
        text = `${text.slice(0, MAX_FILE_BYTES)}\n…(truncated)`;
        truncated = true;
      }
      parts.push(`\n===== FILE: ${node.path} =====\n${text}`);
      total += text.length;
      included += 1;
    } catch {
      /* skip unreadable file */
    }
  }

  if (included === 0) throw new Error('No readable source files found in repository');

  return {
    owner,
    repo,
    defaultBranch: branch,
    description: meta.description || '',
    fileCount: included,
    truncated,
    content: parts.join('\n'),
  };
}
