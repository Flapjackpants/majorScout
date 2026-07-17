"""OpenAI helpers for premium follow-up questions and essay guidance."""

from __future__ import annotations

import json
import os
from typing import Any

from openai import OpenAI

MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


def _client() -> OpenAI | None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    return OpenAI(api_key=api_key)


def _chat_json(system: str, user: str) -> dict | list | None:
    client = _client()
    if client is None:
        return None
    response = client.chat.completions.create(
        model=MODEL,
        temperature=0.7,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    content = response.choices[0].message.content or "{}"
    return json.loads(content)


def generate_followup_questions(profile: dict, prior_answers: dict) -> dict[str, Any]:
    """Return ~4 MCQs and ~2 written prompts tailored to the student."""
    system = (
        "You generate college-major quiz follow-up questions. "
        "Respond with JSON: {"
        '"mcq": [{"id": "ai_mcq_1", "text": "...", "options": '
        '[{"id": "a", "label": "..."}, {"id": "b", "label": "..."}, '
        '{"id": "c", "label": "..."}, {"id": "d", "label": "..."}]}], '
        '"written": [{"id": "ai_written_1", "text": "...", "placeholder": "..."}]}'
        ". Create 4 multiple-choice and 2 short written questions that dig deeper "
        "into interests, extracurriculars, and personality based on prior answers. "
        "Do not include scoring weights."
    )
    user = json.dumps({"profile": profile, "prior_answers": prior_answers})
    result = _chat_json(system, user)
    if result and isinstance(result, dict) and result.get("mcq"):
        return result
    return _fallback_followup()


def generate_essay_guidance(profile: dict, matches: list[dict]) -> list[dict]:
    """Per-university essay approach tips grounded in the student profile."""
    schools = []
    seen = set()
    for m in matches:
        uni = m.get("university")
        if not uni or uni in seen:
            continue
        seen.add(uni)
        schools.append(
            {
                "university": uni,
                "major": m.get("major"),
                "ranking": m.get("ranking"),
            }
        )

    system = (
        "You are a college admissions essay coach. Respond with JSON: "
        '{"guidance": [{"university": "...", "prompt_themes": ["..."], '
        '"approach": "...", "hooks": ["..."]}]}'
        ". For each school, invent plausible supplemental/essay themes "
        "(Why Us, intellectual curiosity, community, etc.) and explain how THIS "
        "student should approach them using their profile. Be specific and actionable. "
        "Keep approach to 2-3 short paragraphs."
    )
    user = json.dumps({"profile": profile, "schools": schools})
    result = _chat_json(system, user)
    if result and isinstance(result, dict) and result.get("guidance"):
        return result["guidance"]
    return _fallback_essay_guidance(schools, profile)


def _fallback_followup() -> dict[str, Any]:
    return {
        "mcq": [
            {
                "id": "ai_mcq_1",
                "text": "When a project hits a wall, what do you do first?",
                "options": [
                    {"id": "a", "label": "Break the problem into smaller pieces and test each one"},
                    {"id": "b", "label": "Talk it through with someone who sees it differently"},
                    {"id": "c", "label": "Look for examples of how others solved something similar"},
                    {"id": "d", "label": "Step away and return with fresh eyes"},
                ],
            },
            {
                "id": "ai_mcq_2",
                "text": "Which kind of recognition means the most to you?",
                "options": [
                    {"id": "a", "label": "Being known as the go-to expert on something hard"},
                    {"id": "b", "label": "Leading a team that ships something people use"},
                    {"id": "c", "label": "Creating work that moves or persuades others"},
                    {"id": "d", "label": "Quietly improving a system that helps many people"},
                ],
            },
            {
                "id": "ai_mcq_3",
                "text": "Pick the elective you'd take just because it sounds fascinating.",
                "options": [
                    {"id": "a", "label": "How algorithms shape everyday decisions"},
                    {"id": "b", "label": "The science of how people form habits"},
                    {"id": "c", "label": "Designing products people actually love"},
                    {"id": "d", "label": "Stories that changed how societies think"},
                ],
            },
            {
                "id": "ai_mcq_4",
                "text": "In a group project, which role feels most natural?",
                "options": [
                    {"id": "a", "label": "The builder who owns the technical core"},
                    {"id": "b", "label": "The organizer who keeps everyone aligned"},
                    {"id": "c", "label": "The researcher who digs up what others miss"},
                    {"id": "d", "label": "The presenter who makes the story land"},
                ],
            },
        ],
        "written": [
            {
                "id": "ai_written_1",
                "text": "Describe one activity or project that best shows how you think. What did you do, and what did you learn?",
                "placeholder": "2–4 sentences",
            },
            {
                "id": "ai_written_2",
                "text": "What question about the world do you keep coming back to — and why does it matter to you?",
                "placeholder": "2–4 sentences",
            },
        ],
    }


def _fallback_essay_guidance(schools: list[dict], profile: dict) -> list[dict]:
    top_interests = sorted(
        (profile.get("interest") or {}).items(), key=lambda x: x[1], reverse=True
    )[:3]
    interest_labels = [k.replace("_", " ") for k, _ in top_interests] or ["your strongest interests"]
    hooks = [
        f"Lead with a concrete moment tied to {interest_labels[0]}.",
        "Connect one extracurricular to a specific campus opportunity.",
        "Show how you collaborate and what you want to build next.",
    ]
    out = []
    for s in schools:
        out.append(
            {
                "university": s["university"],
                "prompt_themes": [
                    f"Why {s['university']}?",
                    "Intellectual curiosity / academic interest",
                    "Community contribution",
                ],
                "approach": (
                    f"For {s['university']}, anchor your story in {', '.join(interest_labels)}. "
                    f"If you're drawn to {s.get('major', 'this program')}, explain a specific "
                    "experience that made that interest feel real — not a résumé list. "
                    "Then name one resource, lab, or community at the school you'd use, and "
                    "close with what you'd contribute back."
                ),
                "hooks": hooks,
            }
        )
    return out
