#!/usr/bin/env python3
"""
Run e2e/journeys-TESTS.yaml against dev (portless) or staging (Docker).

Usage:
  python3 e2e/run-journeys.py                              # dev: portless URL from YAML
  APP_URL=http://localhost:3000 python3 e2e/run-journeys.py  # staging: Docker URL

When APP_URL is set, the test steps and assertions are identical — only the
base URL changes. Outputs land in e2e/:
  dev:     journeys-BROWSER.md     + journeys-RESULTS.json
  staging: journeys-staging-BROWSER.md + journeys-staging-RESULTS.json
"""
import os, sys, subprocess, pathlib

try:
    import yaml
except ImportError:
    sys.exit("pyyaml not found — run: pip install pyyaml")

RUNNER = pathlib.Path.home() / ".claude/skills/gsd-uat-browser/scripts/uat-runner.py"
SPEC   = pathlib.Path(__file__).parent / "journeys-TESTS.yaml"

def main():
    spec     = yaml.safe_load(SPEC.read_text())
    url_override = os.getenv("APP_URL")

    if url_override:
        spec["app"] = url_override
        # Write a staging-named temp YAML so runner output files use
        # "staging" in their names (journeys-staging-BROWSER.md, etc.)
        run_path = SPEC.parent / "journeys-staging-TESTS.yaml"
        run_path.write_text(yaml.dump(spec, default_flow_style=False, allow_unicode=True))
    else:
        run_path = SPEC

    try:
        result = subprocess.run([sys.executable, str(RUNNER), str(run_path)])
        sys.exit(result.returncode)
    finally:
        if url_override and run_path.exists():
            run_path.unlink()

if __name__ == "__main__":
    main()
