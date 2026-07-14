"""Loads and normalizes the college program CSVs in data/."""

import glob
import os
import re

import pandas as pd

DATA_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data"))

# The CSVs use slightly different header names, but the column order is
# consistent, so columns are assigned positionally.
COLUMNS = ["university", "ranking", "college", "major", "acceptance_raw", "description"]

UNIVERSITY_ALIASES = {
    "mit": "MIT",
    "brown university": "Brown University",
    "california institute of technology": "Caltech",
    "cmu": "Carnegie Mellon University",
    "columbia university": "Columbia University",
    "cornell university": "Cornell University",
    "dartmouth college": "Dartmouth College",
    "duke university": "Duke University",
    "emory": "Emory University",
    "georgetown": "Georgetown University",
    "harvard": "Harvard University",
    "johns hopkins university": "Johns Hopkins University",
    "northwestern university": "Northwestern University",
    "notre dame": "University of Notre Dame",
    "princeton": "Princeton University",
    "rice university": "Rice University",
    "stanford": "Stanford University",
    "uc berkeley": "UC Berkeley",
    "ucla": "UCLA",
    "university of chicago": "University of Chicago",
    "u-michigan (ann arbor)": "University of Michigan",
    "university of pennsylvania": "University of Pennsylvania",
    "vanderbilt university": "Vanderbilt University",
    "washu": "Washington University in St. Louis",
    "yale": "Yale University",
}

# Campus size (undergrad enrollment) and setting, used for preference matching.
UNIVERSITY_META = {
    "MIT": {"size": "small", "setting": "urban"},
    "Brown University": {"size": "medium", "setting": "urban"},
    "Caltech": {"size": "small", "setting": "suburban"},
    "Carnegie Mellon University": {"size": "medium", "setting": "urban"},
    "Columbia University": {"size": "medium", "setting": "urban"},
    "Cornell University": {"size": "large", "setting": "college_town"},
    "Dartmouth College": {"size": "small", "setting": "college_town"},
    "Duke University": {"size": "medium", "setting": "suburban"},
    "Emory University": {"size": "medium", "setting": "suburban"},
    "Georgetown University": {"size": "medium", "setting": "urban"},
    "Harvard University": {"size": "medium", "setting": "urban"},
    "Johns Hopkins University": {"size": "medium", "setting": "urban"},
    "Northwestern University": {"size": "medium", "setting": "suburban"},
    "University of Notre Dame": {"size": "medium", "setting": "college_town"},
    "Princeton University": {"size": "small", "setting": "college_town"},
    "Rice University": {"size": "small", "setting": "urban"},
    "Stanford University": {"size": "medium", "setting": "suburban"},
    "UC Berkeley": {"size": "large", "setting": "urban"},
    "UCLA": {"size": "large", "setting": "urban"},
    "University of Chicago": {"size": "medium", "setting": "urban"},
    "University of Michigan": {"size": "large", "setting": "college_town"},
    "University of Pennsylvania": {"size": "medium", "setting": "urban"},
    "Vanderbilt University": {"size": "medium", "setting": "urban"},
    "Washington University in St. Louis": {"size": "medium", "setting": "suburban"},
    "Yale University": {"size": "medium", "setting": "urban"},
}

RANGE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*[\u2013\u2014-]\s*(\d+(?:\.\d+)?)\s*%")
SINGLE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%")


def parse_acceptance_rate(raw):
    """Extract a numeric acceptance rate (percent) from messy text.

    Handles "6.40%", ranges like "3.5-4.5%" (returns the midpoint), and
    prose like "4.6% for the entire university ...".
    """
    if not isinstance(raw, str):
        return None
    match = RANGE_RE.search(raw)
    if match:
        low, high = float(match.group(1)), float(match.group(2))
        return round((low + high) / 2, 2)
    match = SINGLE_RE.search(raw)
    if match:
        return float(match.group(1))
    return None


def _acceptance_display(raw, rate):
    if isinstance(raw, str):
        raw = raw.strip()
        if raw and len(raw) <= 30:
            return raw
    if rate is not None:
        return f"{rate:g}%"
    return "N/A"


def _canonical_university(raw):
    if not isinstance(raw, str):
        return None
    return UNIVERSITY_ALIASES.get(raw.strip().lower(), raw.strip())


def _clean(value):
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value).strip()


def load_programs(data_dir=DATA_DIR):
    """Parse every CSV in data/ into a list of normalized program dicts."""
    programs = []
    seen = set()
    for path in sorted(glob.glob(os.path.join(data_dir, "*.csv"))):
        df = pd.read_csv(path, dtype=str)
        df = df.iloc[:, :6]
        df.columns = COLUMNS
        # Data is grouped: university/ranking/college/acceptance appear only on
        # the first row of each block.
        for col in ("university", "ranking", "college", "acceptance_raw"):
            df[col] = df[col].ffill()

        for row in df.itertuples(index=False):
            major = _clean(row.major)
            description = _clean(row.description)
            # Skip section-header and placeholder rows.
            if not major or not description or major.lower() == "major":
                continue
            university = _canonical_university(row.university)
            if not university:
                continue
            key = (university, major.lower())
            if key in seen:
                continue
            seen.add(key)

            try:
                ranking = int(float(row.ranking))
            except (TypeError, ValueError):
                ranking = None
            rate = parse_acceptance_rate(row.acceptance_raw)
            meta = UNIVERSITY_META.get(university, {})

            programs.append(
                {
                    "id": len(programs),
                    "university": university,
                    "ranking": ranking,
                    "college": _clean(row.college),
                    "major": major,
                    "acceptance_rate": rate,
                    "acceptance_display": _acceptance_display(row.acceptance_raw, rate),
                    "description": description,
                    "size": meta.get("size"),
                    "setting": meta.get("setting"),
                }
            )
    return programs


if __name__ == "__main__":
    progs = load_programs()
    universities = {p["university"] for p in progs}
    with_rate = sum(1 for p in progs if p["acceptance_rate"] is not None)
    print(f"{len(progs)} programs across {len(universities)} universities")
    print(f"{with_rate} programs with parsed acceptance rates")
    for u in sorted(universities):
        print(f"  {u}: {sum(1 for p in progs if p['university'] == u)}")
