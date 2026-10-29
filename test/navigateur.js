// Lance Chromium de Playwright, ou Edge installé si les navigateurs Playwright ne sont pas téléchargés.
const { chromium } = require('playwright');
module.exports = async () => {
  try { return await chromium.launch(); } catch (e) { return chromium.launch({ channel: 'msedge' }); }
};
