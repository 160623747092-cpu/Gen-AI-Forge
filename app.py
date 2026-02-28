from flask import Flask, render_template, request, jsonify
import os
import requests
from werkzeug.utils import secure_filename

# ✅ NEW — Gemini imports
import google.generativeai as genai
from PIL import Image

app = Flask(__name__)

# ===============================
# CONFIG
# ===============================

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

# ✅ UPDATED — added webp
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 🔥 Unsplash key (unchanged)
UNSPLASH_ACCESS_KEY = "Eu3uyoGiQnIk0sT1qjmtF2AZ2iyMnYjhaCA0sHR_IFk"

# ===============================
# ✅ NEW — Gemini setup (SAFE via env var)
# ===============================

genai.configure(api_key=os.getenv("my_genapi"))
model = genai.GenerativeModel("gemini-1.5-flash")

# ===============================
# ROUTES
# ===============================

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/design")
def design_page():
    return render_template("design.html")

@app.route("/basic-designs")
def basic_designs():
    return render_template("basic_designs.html")

@app.route("/assistant")
def assistant_page():
    return render_template("gruha_assistant.html")

# ===============================
# 🔍 UNSPLASH IMAGE SEARCH
# ===============================

@app.route("/search-interiors")
def search_interiors():
    query = request.args.get("query", "").strip()

    if not query:
        return jsonify({"images": []})

    url = "https://api.unsplash.com/search/photos"

    headers = {
        "Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"
    }

    params = {
        "query": f"{query} interior design",
        "per_page": 12,
        "orientation": "landscape"
    }

@app.route("/assistant-chat", methods=["POST"])
def assistant_chat():
    user_msg = request.json.get("message", "")

    try:
        response = model.generate_content(
            f"You are Gruha, a helpful interior design assistant.\nUser: {user_msg}"
        )
        return jsonify({"reply": response.text})

    except Exception as e:
        print("Gemini chat error:", str(e))
        return jsonify({"reply": "Assistant unavailable right now."})


# ===============================
# 🖼️ ROOM IMAGE ANALYSIS (REAL AI)
# ===============================

@app.route("/analyze-room", methods=["POST"])
def analyze_room():
    if "image" not in request.files:
        return jsonify({"reply": "No image received."})

    file = request.files["image"]
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    try:
        img = Image.open(filepath).convert("RGB")

        prompt = """
        You are an expert interior designer.

        Analyze this room and provide:
        • What you observe
        • Improvement suggestions
        • Furniture ideas
        • Estimated budget in INR
        """

        response = model.generate_content([prompt, img])
        return jsonify({"reply": response.text})

    except Exception as e:
        print("Gemini error:", str(e))
        return jsonify({"reply": f"AI analysis failed: {str(e)}"})
# ===============================
# RUN
# ===============================

if __name__ == "__main__":
    app.run(debug=True)
