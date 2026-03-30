'use strict';

/**
 * save-json.js
 * ─────────────────────────────────────────────
 * Responsável por:
 *   1. Garantir que /data existe
 *   2. Salvar sales.json e history.json com formatação legível
 *   3. Fazer backup com timestamp antes de sobrescrever
 *   4. Remover arquivos temporários (_raw.json)
 * ─────────────────────────────────────────────
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

// ─── Configuração ─────────────────────────────────────────────────────────────

const DATA_DIR    = path.resolve(__dirname, '..', process.env.DATA_OUTPUT_DIR || 'data');
const BACKUP_DIR  = path.join(DATA_DIR, '_backups');
const MAX_BACKUPS = 7; // mantém os últimos N backups por arquivo

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Garante que um diretório existe.
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[save] Diretório criado: ${dir}`);
  }
}

/**
 * Timestamp para nome de backup: YYYYMMDD-HHmmss.
 */
function timestamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
}

/**
 * Faz backup do arquivo atual antes de sobrescrever.
 * Mantém apenas os últimos MAX_BACKUPS por arquivo.
 * @param {string} filePath  caminho do arquivo a ser backupeado
 * @param {string} baseName  ex: 'sales'
 */
function backupIfExists(filePath, baseName) {
  if (!fs.existsSync(filePath)) return;

  ensureDir(BACKUP_DIR);
  const dest = path.join(BACKUP_DIR, `${baseName}_${timestamp()}.json`);
  fs.copyFileSync(filePath, dest);
  console.log(`[save] Backup criado: ${path.relative(process.cwd(), dest)}`);

  // Limpa backups antigos
  const existing = fs
    .readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith(`${baseName}_`) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (existing.length > MAX_BACKUPS) {
    existing.slice(MAX_BACKUPS).forEach(f => {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
    });
  }
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Salva um objeto JSON em /data/{name}.json.
 * @param {string} name  'sales' | 'history'
 * @param {object} data
 */
function save(name, data) {
  ensureDir(DATA_DIR);

  const filePath = path.join(DATA_DIR, `${name}.json`);
  backupIfExists(filePath, name);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

  const size = (fs.statSync(filePath).size / 1024).toFixed(1);
  console.log(`[save] ${name}.json salvo (${size} KB) → ${path.relative(process.cwd(), filePath)}`);
}

/**
 * Remove o arquivo temporário _raw.json após processamento.
 */
function cleanRaw() {
  const rawPath = path.join(DATA_DIR, '_raw.json');
  if (fs.existsSync(rawPath)) {
    fs.unlinkSync(rawPath);
    console.log('[save] _raw.json removido.');
  }
}

/**
 * Lê um JSON de /data/{name}.json.
 * @param {string} name
 * @returns {object|null}
 */
function read(name) {
  const filePath = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ─── Entry point ─────────────────────────────────────────────────────────────

if (require.main === module) {
  // Quando chamado diretamente: lê os dados transformados e salva
  const { transform } = require('./transform-sales');
  try {
    const { sales, history } = transform();
    save('sales',   sales);
    save('history', history);
    cleanRaw();
    console.log('[done] Arquivos JSON salvos com sucesso.');
  } catch (err) {
    console.error('[fatal]', err.message);
    process.exit(1);
  }
}

module.exports = { save, read, cleanRaw };
