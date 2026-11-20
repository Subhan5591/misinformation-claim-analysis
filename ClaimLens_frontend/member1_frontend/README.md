# ClaimLens – Member 1 Frontend (hand-off)

## 1. What to copy into the main Flask project
```
project/
├── app.py                      <- main app (Member 2). Do NOT use mine except as reference
├── templates/
│   ├── base.html   index.html   results.html   history.html   error.html
└── static/
    ├── css/style.css
    └── js/app.js
```
`templates` and `static` must sit next to `app.py`. Needs internet (Bootstrap, Bootstrap Icons, Google Fonts from CDN).

## 2. Routes the templates call (names must match exactly, they use url_for)
| Endpoint name | URL | Notes |
|---|---|---|
| `index` | `/` | renders index.html (optional vars: `claim`, `error`, `error_title`) |
| `analyze` | `/analyze` POST | form field name is **`claim`** |
| `results` | `/results/<int:analysis_id>` | renders results.html with `claim`, `result` |
| `latest_result` | `/results` | redirect to newest result, or results.html with `result=None` |
| `history` | `/history` | renders history.html with `records` |
| `download` | `/download/<int:analysis_id>` | returns the PDF (Member 4) |
| `demo` | `/demo/<label>` | TEST ONLY – navbar/home use it; remove with the test buttons |

## 3. Data each template expects
**results.html** gets `claim` (str) and `result`:
```python
result = {
  "id": 1, "created_at": "19 Nov 2026, 11:03",
  "classification": "Supported" | "Refuted" | "Insufficient Information",   # exact spelling
  "score": 0.0-1.0,                       # matching score (not probability of truth)
  "evidence": [{"text": "...", "source": "...", "score": 0.0-1.0, "url": "..."}],   # [] if none
  "explanation": "...",
  "entities": [{"text": "Paris", "label": "GPE"}],   # PERSON, GPE/LOC, ORG, DATE
  "keywords": ["..."]
}
```
**history.html** gets `records`: list of dicts with `id, claim, classification, score, created_at`.

## 4. Rules the backend must follow
- If the best matching score is below a threshold (see `MIN_SCORE` in my app.py) -> `classification = "Insufficient Information"` and `evidence = []`. Copy `enforce_rules()` into the real app.
- Entity `text` must appear in the claim (it is highlighted by string match, case-insensitive).
- Wrap analysis in try/except and re-render index.html with `error=` on failure (see my `/analyze`).

## 5. Before final submission
- [ ] Delete the "Preview the results page" block (`test-bar`) in index.html
- [ ] Delete the `/demo/<label>` route and the "simulate error" test line
- [ ] Check all three results, History page, empty claim, no-evidence claim
- [ ] Hard-refresh (Ctrl+F5) after replacing CSS/JS

Run my stand-in alone: `pip install flask` -> `python app.py` -> http://127.0.0.1:5000
