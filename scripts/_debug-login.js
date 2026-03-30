'use strict';
require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('[debug] Acessando login...');
  await page.goto('https://merchant.onii.app/login', { waitUntil: 'networkidle2', timeout: 30000 });

  // Screenshot
  const ss = path.resolve(__dirname, '../data/_login_debug.png');
  await page.screenshot({ path: ss, fullPage: true });
  console.log('[debug] Screenshot salva em', ss);

  // HTML do form (primeiros 3000 chars)
  const html = await page.evaluate(() => document.body.innerHTML.slice(0, 3000));
  const htmlPath = path.resolve(__dirname, '../data/_login_debug.html');
  fs.writeFileSync(htmlPath, html);
  console.log('[debug] HTML parcial salvo em', htmlPath);

  // Inputs encontrados
  const inputs = await page.evaluate(() =>
    [...document.querySelectorAll('input')].map(el => ({
      type: el.type, id: el.id, name: el.name,
      placeholder: el.placeholder,
      outerHTML: el.outerHTML.slice(0, 200)
    }))
  );
  console.log('[debug] Inputs encontrados:', JSON.stringify(inputs, null, 2));

  await browser.close();
})();
