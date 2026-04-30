'use strict';

/**
 * upload-ftp.js
 * ─────────────────────────────────────────────
 * Envia os arquivos do dashboard para o servidor
 * via FTP usando a biblioteca basic-ftp.
 *
 * Variáveis de ambiente necessárias:
 *   FTP_HOST         → ex: ftp.seusite.com.br
 *   FTP_USER         → usuário FTP
 *   FTP_PASSWORD     → senha FTP
 *   FTP_REMOTE_PATH  → caminho no servidor (ex: /public_html/dashboard)
 *   FTP_SECURE       → true para FTPS (padrão: false)
 *
 * O que é enviado:
 *   - data/sales.json
 *   - data/history.json
 *   - index.html, vendas.html, imagens de raiz (apenas se FTP_FULL_DEPLOY=true)
 *   - css/ e js/              (apenas se FTP_FULL_DEPLOY=true)
 * ─────────────────────────────────────────────
 */

require('dotenv').config();
const ftp  = require('basic-ftp');
const path = require('path');
const fs   = require('fs');

const ROOT       = path.resolve(__dirname, '..');
const DATA_DIR   = path.join(ROOT, process.env.DATA_OUTPUT_DIR || 'data');
const REMOTE     = process.env.FTP_REMOTE_PATH || '/';
const FULL_DEPLOY = process.env.FTP_FULL_DEPLOY === 'true';

// Arquivos enviados a cada sync
const DATA_FILES = [
  { local: path.join(DATA_DIR, 'sales.json'),    remote: 'data/sales.json' },
  { local: path.join(DATA_DIR, 'history.json'),  remote: 'data/history.json' },
  { local: path.join(DATA_DIR, 'stock.json'),    remote: 'data/stock.json' },
  { local: path.join(DATA_DIR, 'products.json'),     remote: 'data/products.json' },
  { local: path.join(DATA_DIR, 'transactions.json'), remote: 'data/transactions.json' },
];

// Arquivos enviados apenas em deploy completo
const STATIC_FILES = [
  { local: path.join(ROOT, 'index.html'),    remote: 'index.html' },
  { local: path.join(ROOT, 'produtos.html'), remote: 'produtos.html' },
  { local: path.join(ROOT, 'avatar-mq.png'), remote: 'avatar-mq.png' },
  { local: path.join(ROOT, '.htaccess'),    remote: '.htaccess' },
];

const STATIC_DIRS = [
  { local: path.join(ROOT, 'css'),       remote: 'css' },
  { local: path.join(ROOT, 'js'),        remote: 'js' },
  { local: path.join(ROOT, 'relatorios'), remote: 'relatorios' },
];

// ─── Upload ───────────────────────────────────────────────────────────────────

async function uploadOnce() {
  const { FTP_HOST, FTP_USER, FTP_PASSWORD } = process.env;

  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    throw new Error('FTP_HOST, FTP_USER e FTP_PASSWORD são obrigatórios no .env');
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;
  client.ftp.timeout = 60000; // 60s timeout no socket de controle

  try {
    await client.access({
      host:          FTP_HOST,
      user:          FTP_USER,
      password:      FTP_PASSWORD,
      secure:        process.env.FTP_SECURE === 'true',
      secureOptions: { rejectUnauthorized: false },
    });

    console.log(`[ftp] Conectado em ${FTP_HOST}`);
    console.log(`[ftp] Caminho remoto: ${REMOTE}`);
    await client.ensureDir(REMOTE);

    // Envia dados (sempre)
    for (const { local, remote } of DATA_FILES) {
      if (!fs.existsSync(local)) {
        console.warn(`[ftp] Arquivo não encontrado, pulando: ${local}`);
        continue;
      }
      const remotePath = path.posix.join(REMOTE, remote);
      await client.ensureDir(path.posix.dirname(remotePath));
      await client.uploadFrom(local, remotePath);
      const size = (fs.statSync(local).size / 1024).toFixed(1);
      console.log(`[ftp] ✓ ${remote} (${size} KB) → ${remotePath}`);
    }

    // Envia arquivos estáticos (deploy completo)
    if (FULL_DEPLOY) {
      console.log('[ftp] Deploy completo ativado...');

      for (const { local, remote } of STATIC_FILES) {
        if (!fs.existsSync(local)) continue;
        const remotePath = path.posix.join(REMOTE, remote);
        await client.uploadFrom(local, remotePath);
        console.log(`[ftp] ✓ ${remote}`);
      }

      for (const { local, remote } of STATIC_DIRS) {
        if (!fs.existsSync(local)) continue;
        const remotePath = path.posix.join(REMOTE, remote);
        await client.uploadFromDir(local, remotePath);
        console.log(`[ftp] ✓ ${remote}/`);
      }
    }

    console.log('[ftp] Upload concluído.');
  } finally {
    client.close();
  }
}

async function upload({ retries = 5, retryDelay = 15000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await uploadOnce();
      return;
    } catch (err) {
      if (attempt < retries) {
        console.warn(`[ftp] Tentativa ${attempt} falhou (${err.message}). Aguardando ${retryDelay / 1000}s...`);
        await new Promise(r => setTimeout(r, retryDelay));
      } else {
        throw err;
      }
    }
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

if (require.main === module) {
  upload().catch(err => {
    console.error('[ftp] Erro:', err.message);
    process.exit(1);
  });
}

module.exports = { upload };
