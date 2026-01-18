import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function checkJson(filePath) {
  const text = readText(filePath);
  JSON.parse(text);
}

function checkJsSyntax(filePath) {
  const text = readText(filePath);
  new vm.Script(text, { filename: path.basename(filePath) });
}

function listJsFiles(dirPath) {
  const out = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJsFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

try {
  checkJson('manifest.json');
  checkJsSyntax('jsonWorker.js');

  const popupDir = 'popup';
  if (!fs.existsSync(popupDir) || !fs.statSync(popupDir).isDirectory()) {
    throw new Error('Missing popup/ directory');
  }
  for (const filePath of listJsFiles(popupDir)) checkJsSyntax(filePath);
  console.log('OK');
} catch (err) {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
}

