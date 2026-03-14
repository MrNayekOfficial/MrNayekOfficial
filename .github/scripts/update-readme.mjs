import { readFile, writeFile } from "node:fs/promises";

const username = process.env.GH_USERNAME || process.env.GITHUB_REPOSITORY_OWNER || "MrNayekOfficial";
const token = process.env.GITHUB_TOKEN;

if (!token) {
  throw new Error("GITHUB_TOKEN is required.");
}

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "User-Agent": "mrnayekofficial-readme-updater",
};

async function gh(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub API ${path} failed: ${response.status} ${details}`);
  }

  return response.json();
}

async function getAllRepos(user) {
  const all = [];

  for (let page = 1; page <= 5; page += 1) {
    const repos = await gh(`/users/${user}/repos?per_page=100&page=${page}&sort=updated`);
    all.push(...repos);
    if (repos.length < 100) break;
  }

  return all;
}

function dateOnly(value) {
  if (!value) return "N/A";
  return new Date(value).toISOString().slice(0, 10);
}

function toK(n) {
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}k`;
}

function formatEvent(event) {
  const repo = event.repo?.name || "unknown/repo";
  const type = event.type || "Event";
  const when = dateOnly(event.created_at);

  if (type === "PushEvent") {
    const commits = event.payload?.commits?.length || 0;
    return `- [${when}] PushEvent in \`${repo}\` (${commits} commit${commits === 1 ? "" : "s"})`;
  }

  if (type === "PullRequestEvent") {
    const action = event.payload?.action || "updated";
    return `- [${when}] PullRequestEvent ${action} in \`${repo}\``;
  }

  if (type === "CreateEvent") {
    const refType = event.payload?.ref_type || "resource";
    return `- [${when}] CreateEvent (${refType}) in \`${repo}\``;
  }

  return `- [${when}] ${type} in \`${repo}\``;
}

function rankFeaturedRepos(repos) {
  return [...repos]
    .sort((a, b) => {
      const starDiff = (b.stargazers_count || 0) - (a.stargazers_count || 0);
      if (starDiff !== 0) return starDiff;

      const watchDiff = (b.watchers_count || 0) - (a.watchers_count || 0);
      if (watchDiff !== 0) return watchDiff;

      return new Date(b.pushed_at) - new Date(a.pushed_at);
    })
    .slice(0, 3);
}

function buildFeaturedProjectsSection(repos) {
  const lines = [];
  const featured = rankFeaturedRepos(repos);

  lines.push("<!-- FEATURED-PROJECTS:START -->");

  if (featured.length === 0) {
    lines.push("<p align=\"center\">No featured repositories available yet.</p>");
  } else {
    for (const repo of featured) {
      lines.push("<p align=\"center\">");
      lines.push(`  <a href=\"${repo.html_url}\">`);
      lines.push(
        `    <img width=\"95%\" src=\"https://github-readme-stats.vercel.app/api/pin/?username=${username}&repo=${encodeURIComponent(repo.name)}&theme=radical&hide_border=true&bg_color=0d1117&title_color=00ffff&icon_color=ff0066&text_color=ffffff\" />`
      );
      lines.push("  </a>");
      lines.push("</p>");
      lines.push("");
    }
  }

  lines.push("<p align=\"center\">");
  lines.push(`  <a href=\"https://github.com/${username}?tab=repositories\">`);
  lines.push(
    "    <img src=\"https://img.shields.io/badge/SEE%20ALL%20PROJECTS-081018?style=for-the-badge&logo=github&logoColor=13ffb1\" />"
  );
  lines.push("  </a>");
  lines.push("</p>");
  lines.push("<!-- FEATURED-PROJECTS:END -->");

  return lines.join("\n");
}

function buildAutoSection({ user, repos, events }) {
  const owned = repos.filter((repo) => repo.owner?.login?.toLowerCase() === username.toLowerCase());
  const nonForkOwned = owned.filter((repo) => !repo.fork);

  const totalStars = nonForkOwned.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
  const topRepos = [...nonForkOwned]
    .sort((a, b) => {
      if ((b.stargazers_count || 0) !== (a.stargazers_count || 0)) {
        return (b.stargazers_count || 0) - (a.stargazers_count || 0);
      }
      return new Date(b.pushed_at) - new Date(a.pushed_at);
    })
    .slice(0, 5);

  const latestRepos = [...nonForkOwned]
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, 5);

  const latestEvents = events.slice(0, 5);

  const lines = [];
  lines.push("<!-- AUTO-DATA:START -->");
  lines.push("### Live Account Snapshot");
  lines.push("");
  lines.push(`- Profile: [@${username}](https://github.com/${username})`);
  lines.push(`- Followers: ${toK(user.followers || 0)}`);
  lines.push(`- Following: ${toK(user.following || 0)}`);
  lines.push(`- Public repos: ${toK(user.public_repos || 0)}`);
  lines.push(`- Total stars (owned repos): ${toK(totalStars)}`);
  lines.push(`- Profile updated: ${dateOnly(user.updated_at)}`);
  lines.push("");
  lines.push("### Top Starred Repositories");
  lines.push("");

  if (topRepos.length === 0) {
    lines.push("- No public repositories found yet.");
  } else {
    for (const repo of topRepos) {
      lines.push(`- [${repo.name}](${repo.html_url}) - ${repo.stargazers_count || 0} stars`);
    }
  }

  lines.push("");
  lines.push("### Recently Updated Repositories");
  lines.push("");

  if (latestRepos.length === 0) {
    lines.push("- No repository updates found yet.");
  } else {
    for (const repo of latestRepos) {
      lines.push(`- [${repo.name}](${repo.html_url}) - pushed ${dateOnly(repo.pushed_at)}`);
    }
  }

  lines.push("");
  lines.push("### Recent Public Activity");
  lines.push("");

  if (latestEvents.length === 0) {
    lines.push("- No recent public activity found.");
  } else {
    for (const event of latestEvents) {
      lines.push(formatEvent(event));
    }
  }

  lines.push("");
  lines.push("_This section is auto-updated every 6 hours by GitHub Actions._");
  lines.push("<!-- AUTO-DATA:END -->");

  return lines.join("\n");
}

const readmePath = "README.md";
const readme = await readFile(readmePath, "utf8");

if (!readme.includes("<!-- AUTO-DATA:START -->") || !readme.includes("<!-- AUTO-DATA:END -->")) {
  throw new Error("README markers AUTO-DATA:START/END not found.");
}

if (!readme.includes("<!-- FEATURED-PROJECTS:START -->") || !readme.includes("<!-- FEATURED-PROJECTS:END -->")) {
  throw new Error("README markers FEATURED-PROJECTS:START/END not found.");
}

const [user, repos, events] = await Promise.all([
  gh(`/users/${username}`),
  getAllRepos(username),
  gh(`/users/${username}/events/public?per_page=20`),
]);

const autoBlock = buildAutoSection({ user, repos, events });
const owned = repos.filter((repo) => repo.owner?.login?.toLowerCase() === username.toLowerCase() && !repo.fork);
const featuredBlock = buildFeaturedProjectsSection(owned);

let updatedReadme = readme.replace(/<!-- FEATURED-PROJECTS:START -->[\s\S]*?<!-- FEATURED-PROJECTS:END -->/, featuredBlock);
updatedReadme = updatedReadme.replace(/<!-- AUTO-DATA:START -->[\s\S]*?<!-- AUTO-DATA:END -->/, autoBlock);

if (updatedReadme !== readme) {
  await writeFile(readmePath, updatedReadme, "utf8");
  console.log("README auto-data section updated.");
} else {
  console.log("README auto-data section already up to date.");
}