import fs from 'fs';
import path from 'path';

function walk(dir, baseUrl) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full, baseUrl));
    } else {
      const rel = path.relative(path.join(process.cwd(), 'public'), full).replace(/\\\\/g, '/');
      results.push({
        url: '/' + rel,
        name: entry.name,
        ext: (entry.name.split('.').pop() || '').toLowerCase()
      });
    }
  }
  return results;
}

export default function handler(req, res) {
  const assetsDir = path.join(process.cwd(), 'public', 'assets');
  try {
    if (!fs.existsSync(assetsDir)) return res.status(200).json([]);
    const files = walk(assetsDir, '/assets');
    res.status(200).json(files);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
