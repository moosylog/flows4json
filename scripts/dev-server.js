const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 7103);
const devCatalogPath = '.dev/catalog.json';
const clients = new Set();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.flows': 'text/plain; charset=utf-8',
};

const liveReloadScript = `
<script>
(() => {
  const events = new EventSource('/__dev/events');
  events.addEventListener('reload', () => window.location.reload());
})();
</script>`;

function buildCatalog() {
  const result = spawnSync(
    process.execPath,
    [path.join(rootDir, 'scripts/build-catalog.js'), '--local', '--output', devCatalogPath],
    {
      cwd: rootDir,
      stdio: 'inherit',
    }
  );

  if (result.status !== 0) {
    console.error('[dev] catalog build failed');
    return false;
  }

  return true;
}

function sendReload() {
  for (const res of clients) {
    res.write('event: reload\ndata: now\n\n');
  }
}

function isWatchedFile(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath);

  if (base === 'catalog.json' || filePath.includes(`${path.sep}.dev${path.sep}`)) {
    return false;
  }

  return ['.flows', '.png', '.jpg', '.jpeg', '.gif', '.html', '.js', '.css'].includes(ext);
}

let reloadTimer;
function scheduleUpdate(filePath) {
  if (!filePath || !isWatchedFile(filePath)) {
    return;
  }

  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    console.log(`[dev] changed: ${path.relative(rootDir, filePath)}`);

    if (['.flows', '.png', '.jpg', '.jpeg', '.gif'].includes(path.extname(filePath))) {
      if (!buildCatalog()) {
        return;
      }
    }

    sendReload();
  }, 120);
}

function watchProject() {
  fs.watch(rootDir, (eventType, filename) => {
    if (filename) {
      scheduleUpdate(path.join(rootDir, filename));
    }
  });

  fs.watch(__dirname, (eventType, filename) => {
    if (filename) {
      scheduleUpdate(path.join(__dirname, filename));
    }
  });
}

function resolveRequestPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const normalizedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const resolvedPath = path.resolve(rootDir, `.${normalizedPath}`);

  if (!resolvedPath.startsWith(rootDir + path.sep) && resolvedPath !== rootDir) {
    return null;
  }

  return resolvedPath;
}

function serveFile(req, res) {
  const filePath = resolveRequestPath(req.url);

  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }

    const ext = path.extname(filePath);
    let body = data;

    if (ext === '.html') {
      body = data.toString('utf8').replace('</body>', `${liveReloadScript}\n</body>`);
    }

    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  });
}

function serveEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  });
  res.write('\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

if (!buildCatalog()) {
  process.exit(1);
}

watchProject();

http
  .createServer((req, res) => {
    if (req.url.startsWith('/__dev/events')) {
      serveEvents(req, res);
      return;
    }

    serveFile(req, res);
  })
  .listen(port, () => {
    console.log(`[dev] http://localhost:${port}`);
  });
