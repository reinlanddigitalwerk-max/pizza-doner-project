// Macht aus den Druckvorlagen in druck/ fertige PDFs und PNG-Vorschauen.
// Vorher: python3 tools/druck.py   ·   Aufruf: node tools/druck-pdf.js
// Braucht Playwright (npm i -g playwright) und Internet für die Schriften.
const path = require('path');
const { chromium } = require('playwright');

const ORDNER = path.join(__dirname, '..', 'druck');
const VORLAGEN = [
  ['flyer-a5', '148mm', '210mm'],
  ['tischkarte-a6', '105mm', '148mm'],
  ['aufkleber-7cm', '70mm', '70mm']
];

(async () => {
  const browser = await chromium.launch();
  for (const [name, breite, hoehe] of VORLAGEN) {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    await page.goto('file://' + path.join(ORDNER, name + '.html'));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await page.pdf({ path: path.join(ORDNER, name + '.pdf'), width: breite, height: hoehe, printBackground: true });
    const seiten = await page.$$('.seite');
    for (let i = 0; i < seiten.length; i++) {
      await seiten[i].screenshot({ path: path.join(ORDNER, name + (seiten.length > 1 ? '-' + (i + 1) : '') + '.png') });
    }
    console.log('geschrieben: druck/' + name + '.pdf');
    await page.close();
  }
  await browser.close();
})();
