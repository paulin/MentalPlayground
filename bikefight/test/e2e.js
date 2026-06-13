"use strict";

// End-to-end test: load the page in headless Chromium, start training at 50x,
// let it run, and check that episodes complete and the DQN trains.
// Run with: node test/e2e.js  (requires a server on :8901 or starts its own)

const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require(require("path").join(
  require("child_process").execSync("npm root -g").toString().trim(),
  "playwright"
));

const ROOT = path.join(__dirname, "..");
const PORT = 8901;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const server = http.createServer((req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const file = path.join(ROOT, urlPath);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
  page.on("console", (msg) => {
    // Resource-load failures (e.g. the CDN being unreachable offline) are
    // tolerated — the page falls back to vendor/tf.min.js.
    if (msg.type() === "error" && !msg.text().includes("Failed to load resource")) {
      errors.push("console: " + msg.text());
    }
  });

  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(
    () => document.getElementById("status").textContent.includes("Ready"),
    { timeout: 30000 }
  );
  console.log("page loaded, agent ready");

  await page.click('[data-speed="50"]');
  await page.click("#btn-train");
  console.log("training at 50x…");

  await page.waitForFunction(
    () => parseInt(document.getElementById("stat-episodes").textContent, 10) >= 3,
    { timeout: 120000 }
  );

  const stats = await page.evaluate(() => ({
    episodes: document.getElementById("stat-episodes").textContent,
    winRate: document.getElementById("stat-winrate").textContent,
    avgReward: document.getElementById("stat-avgreward").textContent,
    epsilon: document.getElementById("stat-epsilon").textContent,
    hitsDealt: document.getElementById("stat-hitsdealt").textContent,
    hitsTaken: document.getElementById("stat-hitstaken").textContent,
    tensors: tf.memory().numTensors,
  }));
  console.log("after training:", stats);

  if (parseFloat(stats.epsilon) >= 1.0) {
    errors.push("epsilon did not decay — training loop may not be running");
  }

  // Exercise pause / best brain / reset
  await page.click("#btn-pause");
  await page.click("#btn-best");
  await page.waitForTimeout(2000);
  const evalStatus = await page.evaluate(() => document.getElementById("status").textContent);
  console.log("eval mode status:", evalStatus);

  await page.click("#btn-reset");
  const afterReset = await page.evaluate(() => ({
    episodes: document.getElementById("stat-episodes").textContent,
    epsilon: document.getElementById("stat-epsilon").textContent,
  }));
  console.log("after reset:", afterReset);
  if (afterReset.episodes !== "0") errors.push("reset did not clear episode count");

  // Tensor leak check: train a bit more and compare tensor counts
  const t0 = await page.evaluate(() => tf.memory().numTensors);
  await page.click("#btn-train");
  await page.waitForTimeout(5000);
  await page.click("#btn-pause");
  await page.waitForTimeout(500);
  const t1 = await page.evaluate(() => tf.memory().numTensors);
  console.log(`tensors: ${t0} -> ${t1}`);
  if (t1 - t0 > 50) errors.push(`possible tensor leak: ${t0} -> ${t1}`);

  await browser.close();
  server.close();

  if (errors.length) {
    console.error("FAIL:\n" + errors.join("\n"));
    process.exit(1);
  }
  console.log("PASS");
})();
