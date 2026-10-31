"use strict";

const $ = id => document.getElementById(id);

const candidateForm = $("candidateForm");
const recommendationForm = $("recommendationForm");
const candidateMessage = $("candidateMessage");
const recommendationMessage = $("recommendationMessage");
const results = $("results");
const resultCount = $("resultCount");
const candidateCount = $("candidateCount");
const topScore = $("topScore");
const avgScore = $("avgScore");
const poolTitle = $("poolTitle");
const searchBox = $("searchBox");
const resetBtn = $("resetBtn");

let currentList = [];
let rankedMode = false;

/* ---------- helpers ---------- */

function escapeHTML(value) {
  const el = document.createElement("div");
  el.textContent = String(value ?? "");
  return el.innerHTML;
}

function setMessage(el, text, isError = false) {
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#b3404a" : "#3f7d58";
}

let toastTimer;
function toast(text, isError = false) {
  const t = $("toast");
  t.textContent = text;
  t.classList.toggle("error", isError);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The server sent something unexpected. Is app.py running?");
  }
  if (!response.ok) throw new Error(data.error || data.message || "Request failed.");
  return data;
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");
}

function chips(list, cls = "") {
  return list.map(s => `<span class="chip ${cls}">${escapeHTML(s)}</span>`).join("");
}

function splitSkills(text) {
  return String(text || "").split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
}

/* ---------- stats ---------- */

function updateStats(total) {
  candidateCount.textContent = total;
}

function updateScores(list) {
  const scores = list.map(c => Number(c.match)).filter(Number.isFinite);
  if (!scores.length) {
    topScore.textContent = "–";
    avgScore.textContent = "–";
    return;
  }
  topScore.textContent = Math.max(...scores).toFixed(0) + "%";
  avgScore.textContent = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(0) + "%";
}

/* ---------- rendering ---------- */

function cardHTML(c, ranked, position) {
  const matching = Array.isArray(c.matching_skills) ? c.matching_skills : [];
  const missing = Array.isArray(c.missing_skills) ? c.missing_skills : [];
  const coverage = Math.max(0, Math.min(100, Number(c.skill_coverage) || 0));
  const score = Number(c.match);
  const tier = score >= 70 ? "high" : score >= 40 ? "mid" : "low";
  const hasExp = c.experience !== undefined && c.experience !== null && c.experience !== "";

  return `
    <article class="candidate-card">
      <div class="candidate-top">
        <div class="avatar">${escapeHTML(initials(c.name))}</div>
        <div>
          <h4>${ranked ? `#${position} ` : ""}${escapeHTML(c.name || "Unknown")}</h4>
          <p class="role">${escapeHTML(c.role || "Role not specified")}</p>
        </div>
        ${ranked && Number.isFinite(score)
          ? `<span class="rank ${tier}">${score.toFixed(0)}% match</span>` : ""}
      </div>

      <div class="chips">${chips(splitSkills(c.skills)) || '<span class="muted">No skills listed</span>'}</div>

      <div class="facts">
        <span>Education: <b>${escapeHTML(c.education || "Not given")}</b></span>
        <span>Experience: <b>${hasExp ? escapeHTML(c.experience) + " yrs" : "Not given"}</b></span>
      </div>

      ${ranked ? `
        <div class="analysis">
          <div>
            <h5>Skills they have</h5>
            <div class="chips">${matching.length ? chips(matching, "yes") : '<span class="muted">None of the required skills</span>'}</div>
          </div>
          <div>
            <h5>Skills they lack</h5>
            <div class="chips">${missing.length ? chips(missing, "no") : '<span class="muted">Nothing missing</span>'}</div>
          </div>
          <div>
            <h5>Coverage</h5>
            <div class="bar"><div class="bar-fill" style="width:${coverage}%"></div></div>
          </div>
          <p>${escapeHTML(c.explanation || "")}</p>
        </div>` : ""}
    </article>`;
}

function render(list) {
  const query = searchBox.value.trim().toLowerCase();

  const shown = query
    ? list.filter(c =>
        [c.name, c.role, c.skills, c.education]
          .join(" ").toLowerCase().includes(query))
    : list;

  resultCount.textContent = `${shown.length} result${shown.length === 1 ? "" : "s"}`;
  poolTitle.textContent = rankedMode ? "Ranked shortlist" : "Candidate pool";

  if (!shown.length) {
    results.innerHTML = `<div class="empty">${
      list.length ? "No one matches that search."
                  : "Nobody here yet. Add your first candidate above."
    }</div>`;
    return;
  }

  results.innerHTML = shown.map((c, i) => cardHTML(c, rankedMode, i + 1)).join("");
}

/* ---------- data ---------- */

async function loadCandidates() {
  try {
    const data = await apiRequest("/api/candidates", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const list = Array.isArray(data) ? data : data.candidates;
    if (!Array.isArray(list)) throw new Error("No candidate list returned.");

    rankedMode = false;
    currentList = list;
    updateStats(list.length);
    updateScores([]);
    render(currentList);
  } catch (err) {
    results.innerHTML = `<div class="empty">${escapeHTML(err.message)}</div>`;
    candidateCount.textContent = "!";
  }
}

/* ---------- events ---------- */

candidateForm.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = candidateForm.querySelector("button[type=submit]");
  btn.disabled = true;
  setMessage(candidateMessage, "Saving...");

  try {
    const fd = new FormData(candidateForm);
    const candidate = {
      name: String(fd.get("name") || "").trim(),
      skills: String(fd.get("skills") || "").trim(),
      education: String(fd.get("education") || "").trim(),
      experience: String(fd.get("experience") || "").trim(),
      role: String(fd.get("role") || "").trim()
    };

    if (!candidate.name) throw new Error("Please enter a name.");
    if (!candidate.skills) throw new Error("Please enter at least one skill.");

    const data = await apiRequest("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(candidate)
    });

    setMessage(candidateMessage, "");
    toast(`${candidate.name} was added.`);
    candidateForm.reset();
    await loadCandidates();
  } catch (err) {
    setMessage(candidateMessage, err.message, true);
  } finally {
    btn.disabled = false;
  }
});

recommendationForm.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = recommendationForm.querySelector("button[type=submit]");
  btn.disabled = true;
  setMessage(recommendationMessage, "Working on it...");

  try {
    const fd = new FormData(recommendationForm);
    const role = String(fd.get("role") || "").trim();
    const requiredSkills = String(fd.get("required_skills") || "").trim();

    if (!requiredSkills) throw new Error("Please enter the skills the job needs.");

    const data = await apiRequest("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ role, job_role: role, required_skills: requiredSkills })
    });

    const list = data.recommendations;
    if (!Array.isArray(list)) throw new Error("Invalid response from server.");

    rankedMode = true;
    currentList = list;
    updateScores(list);
    render(list);

    setMessage(recommendationMessage, "");
    toast(`Ranked ${list.length} candidate${list.length === 1 ? "" : "s"}.`);
    $("pool").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    setMessage(recommendationMessage, err.message, true);
  } finally {
    btn.disabled = false;
  }
});

resetBtn.addEventListener("click", () => {
  searchBox.value = "";
  setMessage(recommendationMessage, "");
  loadCandidates();
});

searchBox.addEventListener("input", () => render(currentList));

/* ---------- navigation ---------- */

const sidebar = $("sidebar");
$("menuBtn").addEventListener("click", () => sidebar.classList.toggle("open"));

document.querySelectorAll(".nav-link").forEach(link =>
  link.addEventListener("click", () => sidebar.classList.remove("open"))
);

const links = document.querySelectorAll(".nav-link");
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      links.forEach(l =>
        l.classList.toggle("active", l.dataset.section === entry.target.id)
      );
    }
  });
}, { rootMargin: "-35% 0px -55% 0px" });

["overview", "add", "match", "pool", "about"].forEach(id => observer.observe($(id)));

loadCandidates();
