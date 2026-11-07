#!/usr/bin/env python3
"""Fetch GitHub Pinned Repositories for the blog's Projects section.

Queries the GitHub GraphQL API for the user's pinned repos, then
updates data/projects.yaml by:
  - Adding new pinned repos (with auto-generated fields)
  - Removing repos that are no longer pinned
  - Preserving existing user overrides (icon, multilingual description)
  - Sorting by commit activity within the last 48h

Usage:
    GITHUB_TOKEN=xxx python3 scripts/sync_projects.py

GITHUB_TOKEN is auto-injected in GitHub Actions. Locally it gracefully
skips the fetch and leaves projects.yaml untouched.
"""
from __future__ import annotations

import json
import os
import re
import sys
import datetime
import urllib.request
import urllib.error
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("pyyaml required: pip install pyyaml\n")
    sys.exit(1)


REPO_OWNER = "shenghongio"
SINCE_HOURS = int(os.environ.get("PROJECTS_ACTIVITY_HOURS", "48"))
YAML_PATH = Path(os.environ.get("PROJECTS_YAML", "data/projects.yaml"))
MAX_PINNED = 10


GRAPHQL_QUERY = """
query GetPinnedRepos($owner: String!, $first: Int!) {
  user(login: $owner) {
    pinnedItems(first: $first, types: REPOSITORY) {
      nodes {
        ... on Repository {
          name
          description
          url
          stargazerCount
          primaryLanguage { name }
        }
      }
    }
  }
}
"""


def graphql_request(query: str, variables: dict, token: str) -> dict:
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": query, "variables": variables}).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "blogio-sync-projects",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())


def fetch_pinned_repos(token: str) -> list[dict]:
    if not token:
        sys.stderr.write("[INFO] No GITHUB_TOKEN, skipping pinned repos fetch\n")
        return []

    try:
        data = graphql_request(
            GRAPHQL_QUERY,
            {"owner": REPO_OWNER, "first": MAX_PINNED},
            token,
        )
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode()[:300]
        except Exception:
            pass
        sys.stderr.write(f"[WARN] GraphQL HTTP {e.code}: {body}\n")
        return []
    except Exception as e:
        sys.stderr.write(f"[WARN] GraphQL error: {e}\n")
        return []

    repos = (
        data.get("data", {})
        .get("user", {})
        .get("pinnedItems", {})
        .get("nodes", [])
    )
    sys.stderr.write(f"[INFO] Fetched {len(repos)} pinned repos from GitHub\n")
    return repos


def _total_commits_from_link(headers) -> int | None:
    link = headers.get("Link", "")
    for part in link.split(","):
        if 'rel="last"' in part:
            m = re.search(r"[?&]page=(\d+)", part)
            if m:
                return int(m.group(1))
    return None


def fetch_commit_count(repo_name: str, since: datetime.datetime, token: str | None) -> int:
    since_iso = since.strftime("%Y-%m-%dT%H:%M:%SZ")
    url = (
        f"https://api.github.com/repos/{REPO_OWNER}/{repo_name}/commits"
        f"?since={since_iso}&per_page=1"
    )
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "blogio-sync-projects")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            count = _total_commits_from_link(resp.headers)
            if count is None:
                body = resp.read().decode()
                count = len(json.loads(body))
            return count
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"  [WARN] {repo_name}: HTTP {e.code}, treating as 0\n")
        return 0
    except Exception as e:
        sys.stderr.write(f"  [WARN] {repo_name}: {e}, treating as 0\n")
        return 0


def guess_icon(language: str | None, name: str) -> str:
    name_lower = name.lower()
    lang_lower = (language or "").lower()
    if name_lower in ("kraken-relayjet", "kraken-toolkit"):
        return "server"
    if name_lower == "ai-native-landscape":
        return "layout"
    if name_lower == "kubernetes-handbook":
        return "book-open"
    if name_lower == "blogio":
        return "github"
    if "kraken" in name_lower:
        return "box"
    if lang_lower in ("go", "golang", "rust", "c", "c++"):
        return "server"
    if lang_lower in ("typescript", "javascript"):
        return "layout"
    if lang_lower in ("html", "css", "hugo"):
        return "globe"
    return "github"


def load_existing_yaml() -> list[dict]:
    if not YAML_PATH.exists():
        return []
    with open(YAML_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f) or []
    if not isinstance(data, list):
        sys.stderr.write("[WARN] projects.yaml is not a list, starting fresh\n")
        return []
    return data


def save_yaml(projects: list[dict]) -> None:
    YAML_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(YAML_PATH, "w", encoding="utf-8") as f:
        yaml.dump(
            projects,
            f,
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
        )


def humanize_repo_name(name: str) -> str:
    s = name.replace("-", " ").replace("_", " ").replace(".", " ")
    parts = s.split()
    acronyms = {"ai", "ml", "k8s", "cli", "sdk", "api", "vm", "os", "gpu", "cpu"}
    result = []
    for p in parts:
        lower = p.lower()
        if lower in acronyms:
            result.append(p.upper())
        elif len(p) <= 3 and p.lower() == p and any(c.isupper() for c in name):
            result.append(p)
        else:
            result.append(p[0].upper() + p[1:] if p else p)
    return " ".join(result)


def merge_with_existing(pinned_repos: list[dict], existing: list[dict]) -> list[dict]:
    existing_by_title = {item["title"]: item for item in existing}
    merged: list[dict] = []

    for repo in pinned_repos:
        name = repo["name"]
        repo_url = repo["url"]
        description_en = repo.get("description") or ""
        language = repo.get("primaryLanguage", {}).get("name") if repo.get("primaryLanguage") else None

        if name in existing_by_title:
            old = existing_by_title[name]
            item = {
                "title": name,
                "display": old.get("display", humanize_repo_name(name)),
                "description": old.get("description", {"en": description_en, "zh": description_en}),
                "icon": old.get("icon", guess_icon(language, name)),
                "url": old.get("url", repo_url),
            }
            if isinstance(item["description"], str):
                item["description"] = {"en": item["description"], "zh": item["description"]}
        else:
            item = {
                "title": name,
                "display": humanize_repo_name(name),
                "description": {"en": description_en, "zh": description_en},
                "icon": guess_icon(language, name),
                "url": repo_url,
            }
            sys.stderr.write(f"  [NEW] {name} → display: {item['display']} ({language or 'unknown lang'})\n")

        merged.append(item)

    return merged


def main() -> int:
    token = os.environ.get("GITHUB_TOKEN")
    existing = load_existing_yaml()

    pinned_repos = fetch_pinned_repos(token)

    if not pinned_repos:
        sys.stderr.write("[INFO] No pinned repos fetched, keeping existing projects.yaml\n")
        sys.stderr.write(f"[INFO] {len(existing)} existing projects unchanged\n")
        return 0

    projects = merge_with_existing(pinned_repos, existing)

    since = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=SINCE_HOURS)
    sys.stderr.write(f"\nSorting by activity (last {SINCE_HOURS}h, since {since.isoformat()}Z)\n")

    original_positions = {item["title"]: i for i, item in enumerate(existing)}
    counts: dict[str, int] = {}
    for item in projects:
        title = item["title"]
        counts[title] = fetch_commit_count(title, since, token)
        sys.stderr.write(f"  {title}: {counts[title]} commits\n")

    projects.sort(key=lambda item: (-counts.get(item["title"], 0), original_positions.get(item["title"], 999)))

    save_yaml(projects)

    sys.stderr.write(f"\nUpdated {YAML_PATH} ({len(projects)} projects):\n")
    for i, item in enumerate(projects, 1):
        sys.stderr.write(f"  {i}. {item['title']} ({counts.get(item['title'], 0)} commits)\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())