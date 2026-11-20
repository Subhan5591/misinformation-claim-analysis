"""Stand-in backend so the Member 1 frontend runs on its own.
Member 2 replaces this file with the real app.py (same route names + template variables)."""
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, abort

app = Flask(__name__)
ANALYSES = {}          # id -> {"claim":..., "result":{...}}   (Member 2: replace with SQLite)

SAMPLES = {
    "supported": ("Nikolaj Coster-Waldau worked with the Fox Broadcasting Company.", {
        "classification": "Supported", "score": 0.91,
        "evidence": [{"text": "Nikolaj Coster-Waldau appeared in the Fox series New Amsterdam.",
                      "source": "Wikipedia: Nikolaj_Coster-Waldau", "score": 0.91,
                      "url": "https://en.wikipedia.org/wiki/Nikolaj_Coster-Waldau"}],
        "explanation": "The closest matching claim in the dataset is labelled Supported, so the evidence supports this claim.",
        "entities": [{"text": "Nikolaj Coster-Waldau", "label": "PERSON"},
                     {"text": "Fox Broadcasting Company", "label": "ORG"}],
        "keywords": ["worked"]}),
    "refuted": ("Barack Obama was born in Kenya in 1965.", {
        "classification": "Refuted", "score": 0.74,
        "evidence": [{"text": "Barack Obama was born in Honolulu, Hawaii, on August 4, 1961.",
                      "source": "Wikipedia: Barack_Obama", "score": 0.74,
                      "url": "https://en.wikipedia.org/wiki/Barack_Obama"}],
        "explanation": "The closest matching claim in the dataset is labelled Refuted, so the evidence contradicts this claim.",
        "entities": [{"text": "Barack Obama", "label": "PERSON"}, {"text": "Kenya", "label": "GPE"},
                     {"text": "1965", "label": "DATE"}],
        "keywords": ["born"]}),
    "insufficient": ("A new vaccine developed in Brazil last week cures all types of flu.", {
        "classification": "Insufficient Information", "score": 0.18, "evidence": [],
        "explanation": "No claim in the dataset was similar enough to decide, so there is not enough information.",
        "entities": [{"text": "Brazil", "label": "GPE"}, {"text": "last week", "label": "DATE"}],
        "keywords": ["vaccine", "cures", "flu"]}),
}

def save(claim, result):
    aid = len(ANALYSES) + 1
    result = {**result, "id": aid, "created_at": datetime.now().strftime("%d %b %Y, %H:%M")}
    ANALYSES[aid] = {"claim": claim, "result": result}
    return aid

MIN_SCORE = 0.35       # below this matching score there is NOT enough evidence (tune with Member 4)
STOP = {"the", "a", "an", "of", "in", "on", "was", "is", "are", "to", "and", "with", "for", "by", "that", "it", "all"}

def _words(t):
    return {w.strip(".,!?;:\"'()").lower() for w in t.split()} - STOP - {""}

def analyse_claim(claim):          # <- Members 3 + 4: replace with real preprocessing + TF-IDF model
    """Stand-in matcher. The matching score is ONE number: the similarity of the best evidence.
    The same value is shown in the score ring and on the evidence card."""
    a = _words(claim)
    best, best_sim = None, 0.0
    for key in ("supported", "refuted"):            # only these act as 'dataset' claims
        c, r = SAMPLES[key]
        b = _words(c)
        sim = len(a & b) / max(len(a | b), 1)
        if sim > best_sim:
            best, best_sim = r, sim
    if best is None or best_sim < MIN_SCORE:
        demo_c, demo_r = SAMPLES["insufficient"]
        ents = demo_r["entities"] if claim.strip().lower() == demo_c.lower() else []
        return {"classification": "Insufficient Information", "score": round(best_sim, 2), "evidence": [],
                "explanation": "No claim in the dataset was similar enough to decide, so there is not enough information.",
                "entities": ents, "keywords": sorted(a)[:5]}
    evidence = [{**ev, "score": round(best_sim, 2)} for ev in best["evidence"]]
    return {**best, "score": round(best_sim, 2), "evidence": evidence}

def enforce_rules(result):
    """Real backend must do the same: low score or no evidence -> Insufficient Information."""
    if not result.get("evidence") or result.get("score", 0) < MIN_SCORE:
        result = {**result, "classification": "Insufficient Information", "evidence": []}
    return result

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/analyze", methods=["POST"])
def analyze():
    claim = request.form.get("claim", "").strip()
    if len(claim) < 10:
        return render_template("index.html", claim=claim, error="Please enter a claim of at least 10 characters.")
    try:
        if "simulate error" in claim.lower():      # test helper: shows the friendly failure message
            raise RuntimeError("test failure")
        result = enforce_rules(analyse_claim(claim))
    except Exception:
        app.logger.exception("Analysis failed")
        return render_template("index.html", claim=claim, error_title="We couldn't analyse that claim",
                               error="Something went wrong on our side. Please try again in a moment."), 500
    return redirect(url_for("results", analysis_id=save(claim, result)))

@app.route("/results/<int:analysis_id>")
def results(analysis_id):
    rec = ANALYSES.get(analysis_id) or abort(404)
    return render_template("results.html", claim=rec["claim"], result=rec["result"])

@app.route("/results")
def latest_result():
    if not ANALYSES:
        return render_template("results.html", result=None)
    return redirect(url_for("results", analysis_id=max(ANALYSES)))

@app.route("/history")
def history():
    records = [{"claim": r["claim"], **r["result"]} for r in sorted(ANALYSES.values(), key=lambda r: -r["result"]["id"])]
    return render_template("history.html", records=records)

@app.route("/download/<int:analysis_id>")
def download(analysis_id):         # <- Member 4: return the ReportLab PDF here
    return "PDF report will be connected by Member 4.", 501

@app.route("/demo/<label>")        # test helper: remove before final submission
def demo(label):
    claim, result = SAMPLES.get(label) or abort(404)
    return redirect(url_for("results", analysis_id=save(claim, result)))

@app.errorhandler(404)
def not_found(e):
    return render_template("error.html", title="Page not found", message="That page or analysis doesn't exist."), 404

@app.errorhandler(500)
def server_error(e):
    return render_template("error.html", title="Something went wrong", message="Please try again in a moment."), 500

if __name__ == "__main__":
    app.run(debug=True)
