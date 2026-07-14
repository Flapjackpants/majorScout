"""Deterministic program matching: keyword tagging + cosine similarity."""

import math
import re

DIMENSIONS = [
    "computing",
    "engineering",
    "math",
    "physical_science",
    "life_science",
    "health",
    "business",
    "economics",
    "social_science",
    "humanities",
    "languages_culture",
    "arts",
    "environment",
    "writing",
]

DIMENSION_LABELS = {
    "computing": "computing and AI",
    "engineering": "engineering and building things",
    "math": "mathematics and quantitative thinking",
    "physical_science": "the physical sciences",
    "life_science": "the life sciences",
    "health": "health and medicine",
    "business": "business and finance",
    "economics": "economics and policy",
    "social_science": "understanding people and society",
    "humanities": "history, philosophy, and big ideas",
    "languages_culture": "languages and world cultures",
    "arts": "the visual and performing arts",
    "environment": "the environment and sustainability",
    "writing": "writing and communication",
}

# Keywords are matched against major name (3x weight) and description (1x).
# Order within a tuple: (pattern, weight).
DIMENSION_KEYWORDS = {
    "computing": [
        (r"computer science", 3), (r"\bcomputing\b", 2.5), (r"artificial intelligence", 3),
        (r"machine learning", 2.5), (r"\bsoftware\b", 2), (r"algorithm", 2),
        (r"\bdata science\b", 2.5), (r"informatics", 2), (r"computational", 2),
        (r"\bcyber", 2), (r"\brobotic", 1.5), (r"programming", 1.5), (r"\bdigital\b", 1),
    ],
    "engineering": [
        (r"engineering", 3), (r"aerospace", 2), (r"mechanical", 2), (r"\bcircuit", 1.5),
        (r"robotics", 2), (r"manufactur", 1.5), (r"aeronautic", 2), (r"astronautic", 2),
        (r"materials science", 2), (r"nanotech", 1.5), (r"structural", 1),
        (r"design and build", 1.5), (r"infrastructure", 1),
    ],
    "math": [
        (r"mathematic", 3), (r"statistic", 2.5), (r"\balgebra\b", 2), (r"probability", 2),
        (r"quantitative", 1.5), (r"actuarial", 2), (r"operations research", 2.5),
        (r"\bcalculus\b", 1.5), (r"\btopology\b", 2), (r"\bgeometry\b", 1.5),
        (r"applied math", 3), (r"econometric", 1.5),
    ],
    "physical_science": [
        (r"\bphysics\b", 3), (r"chemistry", 3), (r"astronomy", 3), (r"astrophysic", 3),
        (r"geolog", 2.5), (r"geophysic", 2.5), (r"planetary", 2.5), (r"\bquantum\b", 2),
        (r"materials", 1.5), (r"geoscience", 2.5), (r"earth science", 2.5),
        (r"spectroscop", 1.5), (r"thermodynamic", 1.5),
    ],
    "life_science": [
        (r"biology", 3), (r"biochem", 2.5), (r"molecular", 2), (r"genetic", 2),
        (r"neuroscience", 2.5), (r"ecology", 2.5), (r"evolution", 2), (r"microbiolog", 2.5),
        (r"physiolog", 2), (r"botany", 2.5), (r"zoolog", 2.5), (r"biolog", 2),
        (r"organism", 1.5), (r"\bcell", 1.5), (r"genomic", 2),
    ],
    "health": [
        (r"\bhealth\b", 3), (r"medicine", 2.5), (r"medical", 2.5), (r"nursing", 3),
        (r"pre-med", 2.5), (r"pharmac", 2.5), (r"epidemiolog", 2.5), (r"clinical", 2),
        (r"biomedical", 2), (r"kinesiolog", 2.5), (r"nutrition", 2.5),
        (r"public health", 3), (r"disease", 1.5),
    ],
    "business": [
        (r"business", 3), (r"finance", 3), (r"financial", 2), (r"management", 2.5),
        (r"marketing", 2.5), (r"accounting", 3), (r"entrepreneur", 2.5),
        (r"\bwharton\b", 2), (r"analytics", 1.5), (r"supply chain", 2.5),
        (r"real estate", 2.5), (r"investment", 2), (r"strateg", 1),
    ],
    "economics": [
        (r"economic", 3), (r"\bpolicy\b", 2.5), (r"political econom", 2.5),
        (r"public affairs", 2.5), (r"international relations", 2), (r"\bmarkets\b", 1.5),
        (r"game theory", 2), (r"econometric", 2), (r"\bgovernance\b", 1.5),
        (r"\btrade\b", 1),
    ],
    "social_science": [
        (r"psycholog", 3), (r"sociolog", 3), (r"anthropolog", 3), (r"political science", 3),
        (r"cognitive", 2), (r"\bpolitics\b", 2), (r"government", 2), (r"education", 2),
        (r"human behavior", 2), (r"criminolog", 2.5), (r"social science", 2.5),
        (r"urban studies", 2), (r"\bsociety\b", 1), (r"inequality", 1.5),
        (r"gender", 1.5), (r"ethnic", 1.5),
    ],
    "humanities": [
        (r"philosoph", 3), (r"history", 2.5), (r"classics", 2.5), (r"religio", 2.5),
        (r"medieval", 2), (r"ancient", 2), (r"humanities", 2.5), (r"archaeolog", 2),
        (r"\bethics\b", 2), (r"folklore", 2), (r"mytholog", 2), (r"theolog", 2.5),
        (r"intellectual tradition", 1.5),
    ],
    "languages_culture": [
        (r"language", 2.5), (r"linguistic", 2.5), (r"east asian", 2.5), (r"french", 2.5),
        (r"spanish", 2.5), (r"german", 2.5), (r"italian", 2.5), (r"chinese", 2.5),
        (r"japanese", 2.5), (r"russian", 2.5), (r"slavic", 2.5), (r"latin american", 2),
        (r"middle east", 2), (r"africana", 2), (r"african", 1.5), (r"asian studies", 2.5),
        (r"cultures", 1.5), (r"global", 1.5), (r"international", 1.5), (r"diaspora", 1.5),
        (r"hispanic", 2.5), (r"portuguese", 2.5), (r"judaic", 2), (r"hebrew", 2),
        (r"arabic", 2), (r"francophone", 2.5), (r"indigenous", 1.5),
    ],
    "arts": [
        (r"\bmusic\b", 3), (r"theater", 3), (r"theatre", 3), (r"\bdance\b", 3),
        (r"\bfilm\b", 2.5), (r"visual art", 3), (r"studio art", 3), (r"\bdesign\b", 2),
        (r"architecture", 2.5), (r"art history", 2.5), (r"\bmedia\b", 1.5),
        (r"performance", 2), (r"paint", 1.5), (r"sculpt", 1.5), (r"photograph", 1.5),
        (r"\bdrama\b", 2), (r"fine art", 2.5), (r"creative", 1.5), (r"\bart\b", 1.5),
    ],
    "environment": [
        (r"environment", 3), (r"sustainab", 2.5), (r"climate", 2.5), (r"\benergy\b", 2),
        (r"conservation", 2), (r"\becolog", 2), (r"earth system", 2.5),
        (r"renewable", 2), (r"atmospher", 2), (r"oceanograph", 2), (r"\bocean\b", 1.5),
        (r"natural resource", 2), (r"agricultur", 2),
    ],
    "writing": [
        (r"english", 2.5), (r"literature", 2.5), (r"\bwriting\b", 3), (r"journalism", 3),
        (r"rhetoric", 2.5), (r"communication", 2.5), (r"literary", 2), (r"\bpoetry\b", 2),
        (r"fiction", 2), (r"\bnovel", 1.5), (r"storytell", 1.5), (r"\bessay", 1.5),
        (r"comparative literature", 2.5),
    ],
}

_COMPILED = {
    dim: [(re.compile(pat, re.IGNORECASE), w) for pat, w in pats]
    for dim, pats in DIMENSION_KEYWORDS.items()
}

# How the final score is blended.
INTEREST_WEIGHT = 0.75
SELECTIVITY_WEIGHT = 0.15
PREFERENCE_WEIGHT = 0.10


def tag_program(program):
    """Compute a dimension weight vector for one program."""
    name = program["major"]
    desc = f"{program['college']} {program['description']}"
    vector = {}
    for dim, patterns in _COMPILED.items():
        score = 0.0
        for regex, weight in patterns:
            if regex.search(name):
                score += 3 * weight
            hits = len(regex.findall(desc))
            if hits:
                score += weight * min(hits, 2)
        if score > 0:
            vector[dim] = score
    return _normalize(vector)


def _normalize(vector):
    norm = math.sqrt(sum(v * v for v in vector.values()))
    if norm == 0:
        return vector
    return {k: v / norm for k, v in vector.items()}


def _cosine(a, b):
    if not a or not b:
        return 0.0
    dot = sum(a.get(k, 0.0) * b.get(k, 0.0) for k in a)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def build_student_profile(answers, questions_by_id):
    """Turn raw quiz answers into an interest vector + academic/preference info.

    `answers` maps question id -> selected option id (or value for sliders).
    """
    interest = {dim: 0.0 for dim in DIMENSIONS}
    strength_points = []
    prefs = {}

    for qid, answer in answers.items():
        question = questions_by_id.get(qid)
        if question is None:
            continue
        option = None
        for opt in question.get("options", []):
            if opt["id"] == answer:
                option = opt
                break
        if option is None:
            continue
        for dim, weight in option.get("weights", {}).items():
            if dim in interest:
                interest[dim] += weight
        if "strength" in option:
            strength_points.append(option["strength"])
        for key, value in option.get("prefs", {}).items():
            prefs[key] = value

    interest = {k: v for k, v in interest.items() if v > 0}
    # Academic strength on 0..1, defaulting to the middle if unanswered.
    strength = sum(strength_points) / len(strength_points) if strength_points else 0.5
    return {"interest": interest, "strength": strength, "prefs": prefs}


def _selectivity_fit(program, strength):
    """Fit between student strength (0..1) and program selectivity."""
    rate = program.get("acceptance_rate")
    if rate is None:
        ranking = program.get("ranking")
        rate = 5.0 if ranking and ranking <= 10 else 9.0
    # Map acceptance rate to a required-strength value: 2% -> ~0.95, 20% -> ~0.5.
    required = max(0.0, min(1.0, 1.0 - (rate - 2.0) / 36.0))
    gap = strength - required
    if gap >= 0:
        # Student is at or above the bar; slight decay so safety picks don't
        # crowd out well-matched reaches.
        return 1.0 - min(gap, 0.5) * 0.2
    return max(0.0, 1.0 + gap * 1.6)


def _preference_fit(program, prefs):
    checks = 0
    matched = 0.0
    if prefs.get("size"):
        checks += 1
        if program.get("size") == prefs["size"]:
            matched += 1
        elif prefs["size"] == "medium" or program.get("size") == "medium":
            matched += 0.5
    if prefs.get("setting"):
        checks += 1
        if program.get("setting") == prefs["setting"]:
            matched += 1
        elif prefs["setting"] == "no_preference":
            matched += 1
    if checks == 0:
        return 0.75
    return matched / checks


def _why_it_fits(program, profile, program_vector):
    """Generate 2-3 personalized reasons this program matches."""
    reasons = []
    shared = sorted(
        (
            (dim, profile["interest"].get(dim, 0) * program_vector.get(dim, 0))
            for dim in program_vector
        ),
        key=lambda item: item[1],
        reverse=True,
    )
    top_dims = [dim for dim, score in shared if score > 0][:2]
    if len(top_dims) == 2:
        reasons.append(
            f"Blends your strong interests in {DIMENSION_LABELS[top_dims[0]]} "
            f"and {DIMENSION_LABELS[top_dims[1]]}."
        )
    elif len(top_dims) == 1:
        reasons.append(
            f"A direct match for your strong interest in {DIMENSION_LABELS[top_dims[0]]}."
        )

    ranking = program.get("ranking")
    if ranking and ranking <= 10:
        reasons.append(
            f"{program['university']} is ranked #{ranking} nationally, and this "
            "program is one of its signature strengths."
        )
    elif ranking:
        reasons.append(
            f"Offered at {program['university']}, ranked #{ranking} nationally."
        )

    rate = program.get("acceptance_rate")
    strength = profile["strength"]
    if rate is not None:
        if strength >= 0.75 and rate < 6:
            reasons.append(
                f"Highly selective (~{rate:g}% admitted), a realistic reach given "
                "your academic record."
            )
        elif rate >= 10:
            reasons.append(
                f"A comparatively accessible admit rate (~{rate:g}%) for a "
                "program of this caliber."
            )
        else:
            reasons.append(f"Admits roughly {rate:g}% of applicants.")
    return reasons[:3]


class Matcher:
    def __init__(self, programs):
        self.programs = programs
        self.vectors = [tag_program(p) for p in programs]

    def match(self, profile, top_n=8, max_per_university=2):
        scored = []
        for program, vector in zip(self.programs, self.vectors):
            interest_fit = _cosine(profile["interest"], vector)
            selectivity_fit = _selectivity_fit(program, profile["strength"])
            preference_fit = _preference_fit(program, profile["prefs"])
            score = (
                INTEREST_WEIGHT * interest_fit
                + SELECTIVITY_WEIGHT * selectivity_fit
                + PREFERENCE_WEIGHT * preference_fit
            )
            scored.append((score, interest_fit, program, vector))

        scored.sort(key=lambda item: item[0], reverse=True)

        results = []
        per_university = {}
        for score, interest_fit, program, vector in scored:
            count = per_university.get(program["university"], 0)
            if count >= max_per_university:
                continue
            per_university[program["university"]] = count + 1
            results.append(
                {
                    **program,
                    "match_percent": round(min(score, 0.99) * 100),
                    "why": _why_it_fits(program, profile, vector),
                }
            )
            if len(results) >= top_n:
                break
        return results
