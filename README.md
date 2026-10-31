# Shortlist: Smart Recruitment System

A web application that helps recruiters shortlist candidates faster. You store candidate profiles, describe a job, and the system ranks everyone by how well their skills cover the job requirements. It also shows which skills each candidate has, which they lack, and a short written reason for the ranking.

Built as an Artificial Intelligence subject project using HTML, CSS, JavaScript and Python (Flask).

---

## Features

- Add candidates with name, skills, education, experience and preferred role
- Rank all candidates against a job role and a list of required skills
- Match percentage, skill coverage bar and a "why recommended" explanation for every candidate
- Matching skills shown in green, missing skills in red
- Live search inside the candidate list
- Sidebar navigation that highlights the current section while scrolling (becomes a slide-out menu on phones)
- Responsive design with a soft yellow, purple and black theme

---

## AI Concepts Used

This project uses **rule-based (classical) AI**. It does not use machine learning.

| Concept | How it is used |
|---|---|
| Knowledge representation | Skills are stored as structured lists that can be compared |
| Text preprocessing | Skills are split, trimmed, de-duplicated and lowercased (`casefold`) |
| Similarity matching | Overlap between candidate skills and required skills (set intersection) |
| Rule-based expert system | Fixed scoring rules decide the match |
| Ranking | Candidates are sorted by score, with role match as a tie-breaker |
| Explainable AI | Matching skills, missing skills and a written reason are shown for each result |

### Scoring formula

```
coverage (%) = matched required skills / total required skills x 100
```

Candidates are sorted by coverage first. If two candidates have the same coverage, a matching preferred role comes first, then the newest entry.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, Flask |
| Database | SQLite |

---

## Project Structure

```
smart-recruitment/
├── app.py          # Flask backend: API, database, matching logic
├── index.html      # Page structure and sidebar navigation
├── style.css       # Styling and responsive layout
├── script.js       # Frontend logic and API calls
└── candidates.db   # SQLite database (created automatically on first run)
```

---

## Getting Started

### Requirements

- Python 3.8 or newer
- pip

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/your-username/smart-recruitment.git
   cd smart-recruitment
   ```

2. (Optional) Create a virtual environment

   ```bash
   python -m venv venv
   source venv/bin/activate      # Windows: venv\Scripts\activate
   ```

3. Install Flask

   ```bash
   pip install flask
   ```

4. Run the app

   ```bash
   python app.py
   ```

5. Open your browser at **http://127.0.0.1:5000**

The database file is created automatically the first time you run the app.

---

## How to Use

1. Go to **Add candidate** and save a few candidates. Separate skills with commas, for example `Python, SQL, Excel`.
2. Go to **Find a match**, enter a job role and the required skills, then click **Rank candidates**.
3. Check the ranked shortlist in the **Candidate pool** section. Click **Show everyone** to go back to the full list.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/candidates` | List all candidates |
| POST | `/api/candidates` | Add a new candidate |
| POST | `/api/recommend` | Rank candidates for a job |
| GET | `/api/health` | Check that the server and database work |

### Example request

`POST /api/recommend`

```json
{
  "role": "Data Analyst",
  "required_skills": "Python, SQL, Statistics"
}
```

### Example response (shortened)

```json
{
  "success": true,
  "count": 1,
  "recommendations": [
    {
      "name": "Asha",
      "matching_skills": ["Python", "SQL", "Statistics"],
      "missing_skills": [],
      "skill_coverage": 100,
      "match": 100,
      "explanation": "Matches 3 of 3 required skills. All required skills are covered."
    }
  ]
}
```

---

## Limitations

- Skills are matched by exact words, so "ML" and "Machine Learning" count as different skills
- Experience and education are stored but not used in the score
- Skills must be typed in manually

## Future Scope

- Synonym handling with NLP and word embeddings
- TF-IDF, cosine similarity or BERT-based resume matching
- Resume PDF upload and automatic skill extraction
- A trained machine learning model for ranking
- Using experience and education in the score
- User login for recruiters


## License

This project was created for academic purposes.
