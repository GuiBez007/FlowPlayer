const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurable music directory
const CONFIG_PATH = path.join(__dirname, 'config.json');
let DATA_DIR = path.resolve(__dirname, 'data');

// Load dynamic data directory on startup if configured
try {
  const fsSync = require('fs');
  if (fsSync.existsSync(CONFIG_PATH)) {
    const config = JSON.parse(fsSync.readFileSync(CONFIG_PATH, 'utf8'));
    if (config.dataDir) {
      DATA_DIR = path.resolve(config.dataDir);
      console.log(`[STARTUP] Diretório de músicas carregado do config: ${DATA_DIR}`);
    }
  }
} catch (err) {
  console.error('[STARTUP] Erro ao carregar config.json:', err);
}

// Serve static frontend files from 'public'
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Enable CORS for visualizer audio stream node (Web Audio API)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Endpoint to change the music directory dynamically
app.post('/api/set-directory', async (req, res) => {
  const { dirPath } = req.body;
  if (!dirPath) {
    return res.status(400).json({ error: 'Caminho do diretório não fornecido.' });
  }

  try {
    const resolvedPath = path.resolve(dirPath);
    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'O caminho fornecido não é uma pasta válida.' });
    }

    DATA_DIR = resolvedPath;
    
    // Persist path to config.json
    await fs.writeFile(CONFIG_PATH, JSON.stringify({ dataDir: DATA_DIR }, null, 2), 'utf8');
    
    console.log(`[DIRECTORY CHANGED] Novo diretório de músicas: ${DATA_DIR}`);
    res.json({ success: true, currentPath: DATA_DIR });
  } catch (error) {
    console.error('Erro ao definir novo diretório:', error);
    res.status(400).json({ error: 'Caminho não encontrado ou inacessível no sistema de arquivos.' });
  }
});

// Endpoint to open a native Windows folder selector dialog
app.get('/api/select-directory', (req, res) => {
  const script = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
    $app = New-Object -ComObject Shell.Application;
    $folder = $app.BrowseForFolder(0, 'Selecione a pasta que contem as músicas do seu computador', 17, 0);
    if ($folder) {
      $folder.Self.Path
    }
  `;
  const formattedScript = script.trim().replace(/\r?\n/g, ' ').replace(/"/g, '\\"');
  const psCommand = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${formattedScript}"`;
  console.log(`[EXECUTE] Running: ${psCommand}`);

  exec(psCommand, (error, stdout, stderr) => {
    console.log(`[EXECUTE STDOUT]: "${stdout}"`);
    console.log(`[EXECUTE STDERR]: "${stderr}"`);
    if (error) {
      console.error('Erro ao executar seletor de pasta:', error);
      return res.status(500).json({ error: 'Erro ao abrir seletor de pasta.', details: stderr });
    }
    const selectedPath = stdout.trim();
    if (!selectedPath) {
      return res.json({ cancelled: true });
    }
    res.json({ path: selectedPath.replace(/\\/g, '/') });
  });
});

// Endpoint to browse folders and files
app.get('/api/browse', async (req, res) => {
  try {
    const relativePath = req.query.path || '';
    const targetPath = path.resolve(DATA_DIR, relativePath);

    // Security check: prevent directory traversal
    if (!targetPath.startsWith(DATA_DIR)) {
      return res.status(403).json({ error: 'Acesso negado. Tentativa de navegar fora do diretório permitido.' });
    }

    // Check if path exists
    try {
      const stats = await fs.stat(targetPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'O caminho especificado não é uma pasta.' });
      }
    } catch {
      return res.status(404).json({ error: 'Pasta não encontrada.' });
    }

    const files = await fs.readdir(targetPath, { withFileTypes: true });
    const items = [];

    for (const file of files) {
      // Ignore hidden files starting with a dot
      if (file.name.startsWith('.')) continue;

      const itemPath = path.join(targetPath, file.name);
      const relPath = path.relative(DATA_DIR, itemPath).replace(/\\/g, '/');

      if (file.isDirectory()) {
        items.push({
          name: file.name,
          isDir: true,
          path: relPath
        });
      } else {
        // Only return audio/video file formats that browsers can typically play
        const ext = path.extname(file.name).toLowerCase();
        const supportedExtensions = ['.mp3', '.mp4', '.m4a', '.wav', '.ogg', '.webm', '.aac'];
        
        if (supportedExtensions.includes(ext)) {
          const stat = await fs.stat(itemPath);
          items.push({
            name: file.name,
            isDir: false,
            path: relPath,
            size: stat.size
          });
        }
      }
    }

    // Sort: directories first (alphabetical), then files (alphabetical)
    items.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    res.json({
      currentPath: relativePath.replace(/\\/g, '/'),
      absoluteDataDir: DATA_DIR,
      items: items
    });
  } catch (error) {
    console.error('Erro ao ler diretório:', error);
    res.status(500).json({ error: 'Erro interno ao processar a requisição.' });
  }
});

// Endpoint to stream media files (supports HTTP Range out-of-the-box via res.sendFile)
app.get('/api/stream', async (req, res) => {
  const relativePath = req.query.path;
  if (!relativePath) {
    return res.status(400).send('Caminho do arquivo não fornecido.');
  }

  const targetPath = path.resolve(DATA_DIR, relativePath);

  // Security check: prevent directory traversal
  if (!targetPath.startsWith(DATA_DIR)) {
    return res.status(403).send('Acesso negado.');
  }

  try {
    const stats = await fs.stat(targetPath);
    if (!stats.isFile()) {
      return res.status(400).send('O caminho especificado não é um arquivo.');
    }

    // sendFile handles HTTP Range requests dynamically.
    // This allows browser media players to seek, skip forward/backward, and load chunks.
    res.sendFile(targetPath, (err) => {
      if (err) {
        if (err.code !== 'ECONNABORTED' && !res.headersSent) {
          console.error('Erro ao transmitir arquivo:', err);
          res.status(500).send('Erro ao transmitir arquivo.');
        }
      }
    });
  } catch (error) {
    console.error('Erro ao acessar arquivo para streaming:', error);
    res.status(404).send('Arquivo não encontrado.');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Diretório de músicas mapeado: ${DATA_DIR}`);
});
