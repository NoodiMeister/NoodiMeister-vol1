import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

function parseIsoDate(value) {
  return new Date(value);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function estimateHours(spanHours) {
  const conservative = Math.min(4, Math.max(0.75, spanHours));
  const realistic = Math.min(8, Math.max(1.5, spanHours * 1.7));
  const intensive = Math.min(10, Math.max(2, spanHours * 2.2));
  return {
    conservative,
    realistic,
    intensive,
  };
}

const raw = execSync("git log --date=iso-strict --pretty=format:'%ad'", {
  encoding: "utf8",
}).trim();

if (!raw) {
  throw new Error("Git log is empty. Cannot build work hour report.");
}

const timestamps = raw
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map(parseIsoDate)
  .sort((a, b) => a.getTime() - b.getTime());

const byDay = new Map();
for (const ts of timestamps) {
  const dayKey = formatIsoDate(ts);
  if (!byDay.has(dayKey)) {
    byDay.set(dayKey, []);
  }
  byDay.get(dayKey).push(ts);
}

const rows = [];
let totalConservative = 0;
let totalRealistic = 0;
let totalIntensive = 0;
let cumulativeRealistic = 0;

for (const [date, events] of [...byDay.entries()].sort((a, b) =>
  a[0].localeCompare(b[0]),
)) {
  const first = events[0];
  const last = events[events.length - 1];
  const spanHours = (last.getTime() - first.getTime()) / (1000 * 60 * 60);
  const estimated = estimateHours(spanHours);

  totalConservative += estimated.conservative;
  totalRealistic += estimated.realistic;
  totalIntensive += estimated.intensive;
  cumulativeRealistic += estimated.realistic;

  rows.push({
    date,
    commits: events.length,
    spanHours: round1(spanHours),
    conservative: round1(estimated.conservative),
    realistic: round1(estimated.realistic),
    intensive: round1(estimated.intensive),
    cumulativeRealistic: round1(cumulativeRealistic),
  });
}

const firstCommit = timestamps[0];
const lastCommit = timestamps[timestamps.length - 1];
const calendarDays =
  Math.floor(
    (new Date(formatIsoDate(lastCommit)).getTime() -
      new Date(formatIsoDate(firstCommit)).getTime()) /
      (1000 * 60 * 60 * 24),
  ) + 1;

const today = new Date();
const generatedAt = today.toISOString().replace("T", " ").slice(0, 19) + " UTC";

const lines = [];
lines.push("# Noodimeister tööaja raport");
lines.push("");
lines.push(`Uuendatud: ${generatedAt}`);
lines.push("");
lines.push("## Kokkuvõte");
lines.push("");
lines.push(`- Commit'e kokku: ${timestamps.length}`);
lines.push(`- Aktiivseid tööpäevi: ${rows.length}`);
lines.push(`- Kalendripäevi perioodis: ${calendarDays}`);
lines.push(`- Esimene commit: ${formatIsoDate(firstCommit)}`);
lines.push(`- Viimane commit: ${formatIsoDate(lastCommit)}`);
lines.push(`- Konservatiivne tundide hinnang: ${round1(totalConservative)} h`);
lines.push(`- Realistlik tundide hinnang: ${round1(totalRealistic)} h`);
lines.push(`- Intensiivne tundide hinnang: ${round1(totalIntensive)} h`);
lines.push("");
lines.push("## Päevade lõikes");
lines.push("");
lines.push(
  "| Kuupäev | Commit'e | Commit-akna kestus (h) | Konservatiivne (h) | Realistlik (h) | Intensiivne (h) | Realistlik kumulatiivne (h) |",
);
lines.push(
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
);
for (const row of rows) {
  lines.push(
    `| ${row.date} | ${row.commits} | ${row.spanHours.toFixed(1)} | ${row.conservative.toFixed(1)} | ${row.realistic.toFixed(1)} | ${row.intensive.toFixed(1)} | ${row.cumulativeRealistic.toFixed(1)} |`,
  );
}
lines.push("");
lines.push("## Märkused");
lines.push("");
lines.push(
  "- Hinnang tugineb git commitide ajatemplitele, mitte automaatsele time-tracking'ule.",
);
lines.push(
  "- Realistlik mudel sobib tavaliselt lisatasu taotluse baasiks; konservatiivne ja intensiivne annavad vahemiku.",
);
lines.push(
  "- Uuenda raportit käsuga: `npm run report:work-hours`",
);

const outputDir = "logs";
const outputPath = `${outputDir}/work-hours-report.md`;
mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

console.log(`Generated ${outputPath}`);
