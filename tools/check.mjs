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

try {
  checkJson('manifest.json');
  checkJsSyntax('popup.js');
  console.log('OK');
} catch (err) {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
}

