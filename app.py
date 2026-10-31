from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os
import re

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "candidates.db")

# ---------------- DATABASE ----------------

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS candidates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                skills TEXT NOT NULL,
                education TEXT DEFAULT '',
                experience TEXT DEFAULT '',
                role TEXT DEFAULT ''
            )
        """)

# ---------------- HELPER FUNCTIONS ----------------

def clean_text(value):
    if value is None:
        return ""
    return str(value).strip()

def split_skills(skills):
    """Convert comma-separated skills into a normalized list."""
    if isinstance(skills, list):
        values = skills
    else:
        values = re.split(r"[,;\n]+", clean_text(skills))

    result = []
    seen = set()

    for value in values:
        skill = clean_text(value)
        normalized = skill.casefold()

        if skill and normalized not in seen:
            result.append(skill)
            seen.add(normalized)

    return result

def candidate_to_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "skills": row["skills"],
        "education": row["education"] or "",
        "experience": row["experience"] or "",
        "role": row["role"] or ""
    }

# ---------------- WEBSITE ----------------

@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")

@app.route("/style.css")
def stylesheet():
    return send_from_directory(BASE_DIR, "style.css")

@app.route("/script.js")
def javascript():
    return send_from_directory(BASE_DIR, "script.js")

# ---------------- CANDIDATES API ----------------

@app.route("/api/candidates", methods=["GET", "POST"])
def candidates_api():

    if request.method == "GET":
        try:
            with get_connection() as conn:
                rows = conn.execute(
                    "SELECT * FROM candidates ORDER BY id DESC"
                ).fetchall()

            candidates = [candidate_to_dict(row) for row in rows]

            return jsonify({
                "success": True,
                "count": len(candidates),
                "candidates": candidates
            }), 200

        except sqlite3.Error as error:
            app.logger.exception("Could not load candidates")
            return jsonify({
                "success": False,
                "error": "Could not load candidates from the database.",
                "details": str(error)
            }), 500

    # POST: Add a candidate
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        data = request.form.to_dict()

    name = clean_text(data.get("name"))
    skills = data.get("skills", "")
    education = clean_text(data.get("education"))
    experience = clean_text(data.get("experience"))
    role = clean_text(data.get("role"))

    if isinstance(skills, list):
        skills = ", ".join(split_skills(skills))
    else:
        skills = ", ".join(split_skills(skills))

    if not name:
        return jsonify({
            "success": False,
            "error": "Candidate name is required."
        }), 400

    if not skills:
        return jsonify({
            "success": False,
            "error": "Please enter at least one skill."
        }), 400

    try:
        with get_connection() as conn:
            cursor = conn.execute("""
                INSERT INTO candidates
                (name, skills, education, experience, role)
                VALUES (?, ?, ?, ?, ?)
            """, (name, skills, education, experience, role))

            candidate_id = cursor.lastrowid

            row = conn.execute(
                "SELECT * FROM candidates WHERE id = ?",
                (candidate_id,)
            ).fetchone()

        candidate = candidate_to_dict(row)

        return jsonify({
            "success": True,
            "message": "Candidate added successfully.",
            "candidate": candidate
        }), 201

    except sqlite3.Error as error:
        app.logger.exception("Could not save candidate")
        return jsonify({
            "success": False,
            "error": "Could not save candidate to the database.",
            "details": str(error)
        }), 500

# ---------------- RECOMMENDATION API ----------------

@app.route("/api/recommend", methods=["POST"])
def recommend_candidates():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        data = request.form.to_dict()

    job_role = clean_text(
        data.get("role") or data.get("job_role")
    )

    required_skills = split_skills(
        data.get("required_skills")
        or data.get("skills")
        or ""
    )

    if not required_skills:
        return jsonify({
            "success": False,
            "error": "Enter the required skills for the job."
        }), 400

    try:
        with get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM candidates ORDER BY id DESC"
            ).fetchall()

        results = []

        required_normalized = {
            skill.casefold() for skill in required_skills
        }

        for row in rows:
            candidate = candidate_to_dict(row)

            candidate_skills = split_skills(candidate["skills"])
            candidate_normalized = {
                skill.casefold() for skill in candidate_skills
            }

            matching_skills = [
                skill for skill in required_skills
                if skill.casefold() in candidate_normalized
            ]

            missing_skills = [
                skill for skill in required_skills
                if skill.casefold() not in candidate_normalized
            ]

            coverage = round(
                len(matching_skills) / len(required_skills) * 100
            )

            # Skill coverage is the main ranking score.
            # A small role bonus breaks ties; it cannot override coverage.
            role_match = bool(
                job_role
                and candidate["role"]
                and job_role.casefold() == candidate["role"].casefold()
            )

            match_score = coverage

            if matching_skills:
                explanation = (
                    f"Matches {len(matching_skills)} of "
                    f"{len(required_skills)} required skills."
                )
            else:
                explanation = (
                    "No exact required-skill matches were found."
                )

            if missing_skills:
                explanation += (
                    " Skills to develop: "
                    + ", ".join(missing_skills)
                    + "."
                )
            else:
                explanation += " All required skills are covered."

            if role_match:
                explanation += " The candidate's preferred role also matches."

            candidate.update({
                "matching_skills": matching_skills,
                "missing_skills": missing_skills,
                "skill_coverage": coverage,
                "match": match_score,
                "explanation": explanation,
                "role_match": role_match
            })

            results.append(candidate)

        results.sort(
            key=lambda item: (
                item["skill_coverage"],
                item["role_match"],
                item["id"]
            ),
            reverse=True
        )

        return jsonify({
            "success": True,
            "job_role": job_role,
            "required_skills": required_skills,
            "count": len(results),
            "recommendations": results
        }), 200

    except sqlite3.Error as error:
        app.logger.exception("Recommendation database error")
        return jsonify({
            "success": False,
            "error": "Could not generate recommendations.",
            "details": str(error)
        }), 500

# ---------------- HEALTH CHECK ----------------

@app.route("/api/health", methods=["GET"])
def health():
    try:
        with get_connection() as conn:
            conn.execute("SELECT 1").fetchone()

        return jsonify({
            "success": True,
            "message": "Flask server and database are working."
        }), 200

    except sqlite3.Error as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

# ---------------- START APPLICATION ----------------

init_db()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
