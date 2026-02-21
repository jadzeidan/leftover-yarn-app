const FREE_PATTERNS_URL = "https://www.woolandthegang.com/en/free-patterns";
const LOCAL_DATASET_URL = "./data/patterns.json";

const proxyTargets = [
  (url) => `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`,
  (url) => `https://cors.isomorphic-git.org/${url}`,
];

const state = {
  patterns: [],
  loadedFrom: "",
};

const els = {
  form: document.getElementById("filter-form"),
  amount: document.getElementById("amount"),
  amountUnit: document.getElementById("amount-unit"),
  yarnType: document.getElementById("yarn-type"),
  yarnWeight: document.getElementById("yarn-weight"),
  status: document.getElementById("status"),
  results: document.getElementById("results"),
  resultCount: document.getElementById("result-count"),
  refreshBtn: document.getElementById("refresh-btn"),
  resultCardTemplate: document.getElementById("result-card-template"),
  yarnTypes: document.getElementById("yarn-types"),
};

init().catch((error) => {
  setStatus(`Startup error: ${error.message}`);
});

async function init() {
  await loadCatalog({ preferLive: true });
  bindEvents();
}

function bindEvents() {
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    runMatch();
  });

  els.refreshBtn.addEventListener("click", async () => {
    els.refreshBtn.disabled = true;
    try {
      await loadCatalog({ preferLive: true, forceLive: true });
      setStatus(`Live catalog refreshed (${state.patterns.length} patterns).`);
    } catch (error) {
      setStatus(`Refresh failed: ${error.message}`);
    } finally {
      els.refreshBtn.disabled = false;
    }
  });
}

async function loadCatalog({ preferLive, forceLive = false }) {
  if (preferLive) {
    try {
      setStatus("Loading live pattern catalog...");
      const livePatterns = await loadLivePatterns();
      if (livePatterns.length >= 5) {
        state.patterns = dedupeByUrl(livePatterns);
        state.loadedFrom = "live";
        updateYarnTypes();
        setStatus(`Loaded ${state.patterns.length} patterns from live source.`);
        return;
      }
      if (forceLive) {
        throw new Error("Live source returned too few patterns.");
      }
    } catch (error) {
      if (forceLive) {
        throw error;
      }
    }
  }

  setStatus("Loading fallback catalog...");
  const res = await fetch(LOCAL_DATASET_URL);
  if (!res.ok) {
    throw new Error("Could not load fallback dataset.");
  }
  state.patterns = await res.json();
  state.loadedFrom = "fallback";
  updateYarnTypes();
  setStatus(`Loaded ${state.patterns.length} patterns from local dataset.`);
}

async function loadLivePatterns() {
  const listingText = await fetchWithProxies(FREE_PATTERNS_URL);
  const links = parsePatternLinks(listingText);

  const candidates = links.slice(0, 24);
  const details = await Promise.all(
    candidates.map(async (link) => {
      try {
        const text = await fetchWithProxies(link.url);
        return parsePatternDetail(text, link);
      } catch {
        return {
          title: link.title,
          url: link.url,
          yarnType: "unknown",
          yarnWeight: "unknown",
          amountMin: 0,
          amountUnit: "g",
          notes: "Could not parse yarn details from live page.",
          confidence: "low",
        };
      }
    })
  );

  return details;
}

async function fetchWithProxies(url) {
  for (const builder of proxyTargets) {
    const proxyUrl = builder(url);
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        continue;
      }
      const text = await response.text();
      if (text.length > 500) {
        return text;
      }
    } catch {
      // Try next proxy.
    }
  }
  throw new Error(`Unable to fetch ${url}`);
}

function parsePatternLinks(text) {
  const links = [];
  const regex = /\[(.*?)\]\((https?:\/\/www\.woolandthegang\.com\/en\/products\/[^)]+)\)/gi;
  let match = regex.exec(text);

  while (match) {
    const title = sanitizeTitle(match[1]);
    links.push({ title, url: match[2] });
    match = regex.exec(text);
  }

  return dedupeByUrl(links);
}

function parsePatternDetail(text, base) {
  const lower = text.toLowerCase();

  const amountMatch =
    text.match(/(\d{2,4})\s*(g|grams|gram)\b/i) || text.match(/(\d{2,4})\s*(m|meters|metres)\b/i);

  const yarnWeight =
    findFirst(lower, ["super bulky", "bulky", "aran", "worsted", "dk", "sport", "fingering", "lace"]) ||
    "unknown";

  const yarnType =
    findFirst(lower, ["wool", "cotton", "alpaca", "merino", "mohair", "acrylic", "cashmere", "linen"]) ||
    "unknown";

  return {
    title: base.title,
    url: base.url,
    yarnType,
    yarnWeight,
    amountMin: amountMatch ? Number.parseInt(amountMatch[1], 10) : 0,
    amountUnit: amountMatch?.[2].toLowerCase().startsWith("m") ? "m" : "g",
    notes: amountMatch
      ? "Live details parsed from pattern page text."
      : "Amount not found in live page text; treat as approximate match.",
    confidence: amountMatch ? "medium" : "low",
  };
}

function findFirst(text, options) {
  for (const option of options) {
    if (text.includes(option)) {
      return option;
    }
  }
  return "";
}

function runMatch() {
  const amount = Number.parseInt(els.amount.value, 10);
  const amountUnit = els.amountUnit.value;
  const yarnType = normalize(els.yarnType.value);
  const yarnWeight = normalize(els.yarnWeight.value);

  const scored = state.patterns
    .map((pattern) => ({
      pattern,
      score: scorePattern(pattern, { amount, amountUnit, yarnType, yarnWeight }),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  renderResults(scored.map((item) => item.pattern));
}

function scorePattern(pattern, input) {
  let score = 0;

  const type = normalize(pattern.yarnType);
  const weight = normalize(pattern.yarnWeight);

  if (type === input.yarnType) {
    score += 40;
  } else if (type.includes(input.yarnType) || input.yarnType.includes(type)) {
    score += 24;
  }

  if (weight === input.yarnWeight) {
    score += 35;
  }

  const converted = convertAmount(pattern.amountMin, pattern.amountUnit, input.amountUnit);
  if (Number.isFinite(converted)) {
    if (input.amount >= converted) {
      score += 25;
    } else if (input.amount >= converted * 0.8) {
      score += 8;
    }
  } else {
    score += 4;
  }

  return score;
}

function convertAmount(value, fromUnit, toUnit) {
  if (!value || fromUnit === toUnit) {
    return value;
  }

  // Rough conversion for wool yarn average: 100g ~= 120m.
  if (fromUnit === "g" && toUnit === "m") {
    return Math.round(value * 1.2);
  }
  if (fromUnit === "m" && toUnit === "g") {
    return Math.round(value / 1.2);
  }
  return Number.NaN;
}

function renderResults(patterns) {
  els.results.replaceChildren();
  els.resultCount.textContent = `${patterns.length} shown`;

  if (!patterns.length) {
    const empty = document.createElement("p");
    empty.textContent = "No strong matches. Try a broader yarn type (e.g. wool) or a neighboring yarn weight.";
    els.results.append(empty);
    return;
  }

  for (const pattern of patterns) {
    const node = els.resultCardTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".card-title").textContent = pattern.title;
    node.querySelector(".confidence").textContent = `Source confidence: ${pattern.confidence || "unknown"}`;

    const meta = node.querySelector(".meta");
    appendChip(meta, `Type: ${pattern.yarnType}`);
    appendChip(meta, `Weight: ${pattern.yarnWeight}`);
    appendChip(meta, `Min: ${pattern.amountMin || "?"}${pattern.amountUnit || "g"}`);

    node.querySelector(".notes").textContent = pattern.notes || "";

    const link = node.querySelector(".pattern-link");
    link.href = pattern.url;
    link.textContent = "Open on woolandthegang.com";

    els.results.append(node);
  }
}

function appendChip(parent, text) {
  const li = document.createElement("li");
  li.textContent = text;
  parent.append(li);
}

function updateYarnTypes() {
  els.yarnTypes.replaceChildren();
  const set = new Set(state.patterns.map((pattern) => pattern.yarnType).filter(Boolean));

  for (const type of [...set].sort()) {
    const option = document.createElement("option");
    option.value = type;
    els.yarnTypes.append(option);
  }
}

function dedupeByUrl(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    if (!item.url || seen.has(item.url)) {
      continue;
    }
    seen.add(item.url);
    result.push(item);
  }

  return result;
}

function sanitizeTitle(title) {
  return title
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*Wool and the Gang$/i, "")
    .trim();
}

function normalize(value) {
  return (value || "").toString().trim().toLowerCase();
}

function setStatus(message) {
  const sourceTag = state.loadedFrom ? ` (${state.loadedFrom})` : "";
  els.status.textContent = `${message}${sourceTag}`;
}
