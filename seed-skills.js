#!/usr/bin/env node
/**
 * seed-skills.js — Popula a tabela skills_content no Supabase
 * Lê todos os arquivos .md de /home/riibeirol/skills-juridicas/
 * e faz upsert via REST API.
 *
 * Uso: node seed-skills.js
 * Requer Node 18+ (fetch nativo)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// Configuração
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fizgujocdsnnvmwbrvgq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
// IMPORTANTE: use a service_role key (não a anon key) para inserir dados
// Execute: SUPABASE_SERVICE_KEY=sua_key node seed-skills.js

const SKILLS_ROOT = path.resolve(__dirname, '..');

// Pastas a ignorar dentro de SKILLS_ROOT
const IGNORE_DIRS = new Set(['landing-page', 'members', '.git', 'node_modules']);
// Arquivos a ignorar
const IGNORE_FILES = new Set(['FRAMEWORK.md', 'COMO-USAR.md', 'README.md']);

// ============================================================
// Parser de arquivo .md
// ============================================================
function parseSkillFile(filePath, area) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);

  // Número da skill a partir do nome do arquivo (ex: 01-peticao... → 1)
  const numMatch = filename.match(/^(\d+)-/);
  const numero = numMatch ? parseInt(numMatch[1], 10) : 0;

  // Nome do frontmatter YAML
  let nome = '';
  const frontmatterMatch = content.match(/^---[\s\S]*?nome:\s*(.+)\n[\s\S]*?---/);
  if (frontmatterMatch) {
    nome = frontmatterMatch[1].trim();
  } else {
    // Fallback: primeiro heading H1
    const h1Match = content.match(/^#\s+(.+)$/m);
    nome = h1Match ? h1Match[1].trim() : filename.replace(/^\d+-/, '').replace(/-/g, ' ').replace('.md', '');
  }

  // Área do frontmatter (se existir), senão usa o diretório
  let areaFinal = area;
  const areaMatch = content.match(/^---[\s\S]*?area:\s*(.+)\n[\s\S]*?---/);
  if (areaMatch) {
    areaFinal = areaMatch[1].trim();
  }

  // Descrição — seção "## O que faz"
  const descMatch = content.match(/##\s+O que faz\s*\n([\s\S]*?)(?=\n##|\n---)/);
  const descricao = descMatch ? descMatch[1].trim() : '';

  // Quando usar — seção "## Quando usar"
  const quandoMatch = content.match(/##\s+Quando usar\s*\n([\s\S]*?)(?=\n##|\n---)/);
  const quando_usar = quandoMatch ? quandoMatch[1].trim() : '';

  // Prompt — bloco de código após "## O Prompt"
  const promptMatch = content.match(/##\s+O Prompt\s*\n+```[^\n]*\n([\s\S]*?)```/);
  const prompt = promptMatch ? promptMatch[1].trim() : '';

  // Dicas — seção "## Dicas de Uso"
  const dicasMatch = content.match(/##\s+Dicas de Uso\s*\n([\s\S]*?)(?=\n##|$)/);
  const dicas = dicasMatch ? dicasMatch[1].trim() : '';

  return {
    area: areaFinal,
    numero,
    nome,
    descricao: descricao || null,
    quando_usar: quando_usar || null,
    prompt,
    dicas: dicas || null,
  };
}

// ============================================================
// Varredura de arquivos
// ============================================================
function collectSkills() {
  const skills = [];

  const entries = fs.readdirSync(SKILLS_ROOT, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (IGNORE_DIRS.has(entry.name)) continue;

    const area = entry.name;
    const areaDir = path.join(SKILLS_ROOT, area);
    const files = fs.readdirSync(areaDir);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      if (IGNORE_FILES.has(file)) continue;

      const filePath = path.join(areaDir, file);
      try {
        const skill = parseSkillFile(filePath, area);
        if (!skill.prompt) {
          console.warn(`  [AVISO] Prompt vazio em ${filePath} — pulando`);
          continue;
        }
        skills.push(skill);
        console.log(`  [OK] ${area}/${file} → "${skill.nome}"`);
      } catch (err) {
        console.error(`  [ERRO] ${filePath}: ${err.message}`);
      }
    }
  }

  return skills;
}

// ============================================================
// Upsert no Supabase
// ============================================================
async function upsertSkills(skills) {
  if (!SUPABASE_SERVICE_KEY) {
    console.error('\n[ERRO] SUPABASE_SERVICE_KEY não definida.');
    console.error('Execute: SUPABASE_SERVICE_KEY=sua_service_role_key node seed-skills.js\n');
    process.exit(1);
  }

  const url = `${SUPABASE_URL}/rest/v1/skills_content`;
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
  };

  // Envia em lotes de 50 para não estourar limites
  const BATCH = 50;
  let total = 0;

  for (let i = 0; i < skills.length; i += BATCH) {
    const batch = skills.slice(i, i + BATCH);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[ERRO] Lote ${i / BATCH + 1}: ${res.status} — ${body}`);
    } else {
      total += batch.length;
      console.log(`[UPSERT] Lote ${i / BATCH + 1}: ${batch.length} skills inseridas/atualizadas`);
    }
  }

  return total;
}

// ============================================================
// Main
// ============================================================
(async () => {
  console.log('='.repeat(60));
  console.log('Skills Jurídicas com IA — Seed do banco de dados');
  console.log('='.repeat(60));
  console.log(`\nVarredura em: ${SKILLS_ROOT}\n`);

  const skills = collectSkills();
  console.log(`\nTotal encontrado: ${skills.length} skills\n`);

  if (skills.length === 0) {
    console.log('Nenhuma skill encontrada. Verifique o caminho e os arquivos .md.');
    process.exit(0);
  }

  console.log('Enviando para o Supabase...\n');
  const total = await upsertSkills(skills);

  console.log('\n' + '='.repeat(60));
  console.log(`Concluído: ${total} skills inseridas/atualizadas`);
  console.log('='.repeat(60));
})();
