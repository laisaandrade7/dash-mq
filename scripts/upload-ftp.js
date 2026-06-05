'use strict';

/**
 * upload-ftp.js
 * ─────────────────────────────────────────────
 * Envia os arquivos do dashboard para o servidor
 * via SFTP (SSH, porta 22) usando ssh2-sftp-client.
 *
 * Usa as mesmas variáveis de ambiente do FTP anterior:
 *   FTP_HOST         → hostname do servidor (mesmo usado no FTP)
 *   FTP_USER         → usuário SSH/SFTP
 *   FTP_PASSWORD     → senha SSH/SFTP
 *   FTP_REMOTE_PATH  → caminho no servidor (ex: /domains/laisaandrade.com.br/public_html/dash-mq)
 *   FTP_PORT         → porta SFTP (padrão: 22)
 * ─────────────────────────────────────────────
 */

require('dotenv').config();
const SftpClient = require('ssh2-sftp-client');
const path = require('path');
const fs   = require('fs');

const ROOT        = path.resolve(__dirname, '..');
const DATA_DIR    = path.join(ROOT, process.env.DATA_OUTPUT_DIR || 'data');
const REMOTE      = process.env.FTP_REMOTE_PATH || '/';
const FULL_DEPLOY = process.env.FTP_FULL_DEPLOY === 'true';

// Arquivos enviados a cada sync
const DATA_FILES = [
  { local: path.join(DATA_DIR, 'sales.json'),        remote: 'data/sales.json' },
  { local: path.join(DATA_DIR, 'history.json'),      remote: 'data/history.json' },
  { local: path.join(DATA_DIR, 'stock.json'),        remote: 'data/stock.json' },
  { local: path.join(DATA_DIR, 'products.json'),     remote: 'data/products.json' },
  { local: path.join(DATA_DIR, 'transactions.json'), remote: 'data/transactions.json' },
];

// Arquivos enviados apenas em deploy completo
const STATIC_FILES = [
  { local: path.join(ROOT, 'index.html'),        remote: 'index.html' },
  { local: path.join(ROOT, 'login.html'),        remote: 'login.html' },
  { local: path.join(ROOT, 'produtos.html'),     remote: 'produtos.html' },
  { local: path.join(ROOT, 'financas.html'),     remote: 'financas.html' },
  { local: path.join(DATA_DIR, 'financas.json'), remote: 'data/financas.json' },
  { local: path.join(ROOT, 'avatar-mq.png'),     remote: 'avatar-mq.png' },
  { local: path.join(ROOT, '.htaccess'),         remote: '.htaccess' },
];

const STATIC_DIRS = [
  { local: path.join(ROOT, 'css'),        remote: 'css' },
  { local: path.join(ROOT, 'js'),         remote: 'js' },
  { local: path.join(ROOT, 'relatorios'), remote: 'relatorios' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureDir(sftp, remotePath) {
  const exists = await sftp.exists(remotePath);
  if (!exists) {
    await sftp.mkdir(remotePath, true);
  }
}

// ─── Upload ───────────────────────────────────────────────────────────────────

async function uploadOnce() {
  const { FTP_HOST, FTP_USER, FTP_PASSWORD } = process.env;

  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    throw new Error('FTP_HOST, FTP_USER e FTP_PASSWORD são obrigatórios no .env');
  }

  const sftp = new SftpClient();

  try {
    await sftp.connect({
      host:         FTP_HOST,
      port:         parseInt(process.env.FTP_PORT || '22', 10),
      username:     FTP_USER,
      password:     FTP_PASSWORD,
      readyTimeout: 60000,
      // Aceita qualquer host key sem verificação (equivalente ao rejectUnauthorized:false do FTP)
      algorithms: { serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519'] },
    });

    console.log(`[ftp] Conectado em ${FTP_HOST} (SFTP)`);
    console.log(`[ftp] Caminho remoto: ${REMOTE}`);
    await ensureDir(sftp, REMOTE);

    // Envia dados (sempre)
    for (const { local, remote } of DATA_FILES) {
      if (!fs.existsSync(local)) {
        console.warn(`[ftp] Arquivo não encontrado, pulando: ${local}`);
        continue;
      }
      const remotePath = path.posix.join(REMOTE, remote);
      await ensureDir(sftp, path.posix.dirname(remotePath));
      await sftp.put(local, remotePath);
      const size = (fs.statSync(local).size / 1024).toFixed(1);
      console.log(`[ftp] ✓ ${remote} (${size} KB) → ${remotePath}`);
    }

    // Envia arquivos estáticos (deploy completo)
    if (FULL_DEPLOY) {
      console.log('[ftp] Deploy completo ativado...');

      for (const { local, remote } of STATIC_FILES) {
        if (!fs.existsSync(local)) continue;
        const remotePath = path.posix.join(REMOTE, remote);
        await sftp.put(local, remotePath);
        console.log(`[ftp] ✓ ${remote}`);
      }

      for (const { local, remote } of STATIC_DIRS) {
        if (!fs.existsSync(local)) continue;
        const remotePath = path.posix.join(REMOTE, remote);
        await sftp.uploadDir(local, remotePath);
        console.log(`[ftp] ✓ ${remote}/`);
      }
    }

    console.log('[ftp] Upload concluído.');
  } finally {
    await sftp.end();
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
