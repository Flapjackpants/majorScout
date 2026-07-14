"""Flask API for MajorScout."""

import json
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from data_loader import load_programs
from matching import Matcher, build_student_profile

app = Flask(__name__)
CORS(app)

PROGRAMS = load_programs()
MATCHER = Matcher(PROGRAMS)

with open(os.path.join(os.path.dirname(__file__), "questions.json")) as f:
    QUESTION_BANK = json.load(f)

QUESTIONS_BY_ID = {q["id"]: q for q in QUESTION_BANK["questions"]}


@app.get("/api/stats")
def stats():
    universities = {p["university"] for p in PROGRAMS}
    majors = {p["major"].lower() for p in PROGRAMS}
    return jsonify(
        {
            "programs": len(PROGRAMS),
            "universities": len(universities),
            "majors": len(majors),
            "questions": len(QUESTION_BANK["questions"]),
        }
    )


@app.get("/api/questions")
def questions():
    # Strip scoring metadata so the client only sees display fields.
    public = {
        "sections": QUESTION_BANK["sections"],
        "questions": [
            {
                "id": q["id"],
                "section": q["section"],
                "text": q["text"],
                "options": [
                    {"id": o["id"], "label": o["label"]} for o in q["options"]
                ],
            }
            for q in QUESTION_BANK["questions"]
        ],
    }
    return jsonify(public)


@app.post("/api/match")
def match():
    payload = request.get_json(silent=True) or {}
    answers = payload.get("answers")
    if not isinstance(answers, dict) or not answers:
        return jsonify({"error": "Request body must include an 'answers' object."}), 400

    profile = build_student_profile(answers, QUESTIONS_BY_ID)
    if not profile["interest"]:
        return jsonify({"error": "Not enough interest answers to build a match."}), 400

    results = MATCHER.match(profile, top_n=8)
    return jsonify({"results": results})


if __name__ == "__main__":
    app.run(port=5001, debug=True)
