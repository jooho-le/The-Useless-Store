from flask import Flask, request, jsonify, send_from_directory
import os
from flask_cors import CORS
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from .config import PORT, CLIENT_ORIGIN
from .db import init_db, SessionLocal
from .models import User, Score
from .utils import hash_password, verify_password, make_token, verify_token


def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": CLIENT_ORIGIN if CLIENT_ORIGIN != '*' else '*'}})

    init_db()

    # Path to project root (where index.html, main.js, style.css live)
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

    @app.get('/api/health')
    def health():
        return jsonify({"ok": True})

    # Auth routes
    @app.post('/api/auth/signup')
    def signup():
        data = request.get_json(silent=True) or {}
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''
        name = data.get('name')
        if not email or not password:
            return jsonify({"error": "missing_fields"}), 400
        with SessionLocal() as db:  # type: Session
            exists = db.scalar(select(func.count()).select_from(User).where(User.email == email))
            if exists:
                return jsonify({"error": "email_in_use"}), 409
            u = User(email=email, password_hash=hash_password(password), name=name)
            db.add(u)
            db.commit()
            db.refresh(u)
            token = make_token(u)
            return jsonify({"token": token, "user": {"id": u.id, "email": u.email, "name": u.name}}), 201

    @app.post('/api/auth/login')
    def login():
        data = request.get_json(silent=True) or {}
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''
        if not email or not password:
            return jsonify({"error": "missing_fields"}), 400
        with SessionLocal() as db:  # type: Session
            u = db.scalar(select(User).where(User.email == email))
            if not u or not verify_password(u.password_hash, password):
                return jsonify({"error": "invalid_credentials"}), 401
            token = make_token(u)
            return jsonify({"token": token, "user": {"id": u.id, "email": u.email, "name": u.name}})

    def require_auth():
        auth = request.headers.get('Authorization', '')
        parts = auth.split(' ')
        if len(parts) == 2 and parts[0].lower() == 'bearer':
            token = parts[1]
            try:
                payload = verify_token(token)
                return payload
            except Exception:
                pass
        return None

    @app.get('/api/auth/me')
    def me():
        payload = require_auth()
        if not payload:
            return jsonify({"error": "invalid_token"}), 401
        with SessionLocal() as db:  # type: Session
            u = db.get(User, payload['sub'])
            if not u:
                return jsonify({"error": "not_found"}), 404
            return jsonify({"user": {"id": u.id, "email": u.email, "name": u.name, "created_at": str(u.created_at)}})

    # Scores
    @app.post('/api/scores')
    def post_score():
        payload = require_auth()
        if not payload:
            return jsonify({"error": "invalid_token"}), 401
        data = request.get_json(silent=True) or {}
        try:
            s = int(data.get('score', 0))
        except Exception:
            return jsonify({"error": "invalid_score"}), 400
        if s < 0:
            return jsonify({"error": "invalid_score"}), 400
        with SessionLocal() as db:  # type: Session
            sc = Score(user_id=payload['sub'], score=s)
            db.add(sc)
            db.commit()
        return jsonify({"ok": True}), 201

    @app.get('/api/scores/my')
    def my_scores():
        payload = require_auth()
        if not payload:
            return jsonify({"error": "invalid_token"}), 401
        with SessionLocal() as db:  # type: Session
            recent = db.execute(
                select(Score.id, Score.score, Score.created_at)
                .where(Score.user_id == payload['sub'])
                .order_by(Score.created_at.desc())
                .limit(20)
            ).mappings().all()
            best = db.scalar(select(func.max(Score.score)).where(Score.user_id == payload['sub'])) or 0
            return jsonify({"recent": [dict(r) for r in recent], "best": int(best)})

    @app.get('/api/scores/leaderboard')
    def leaderboard():
        with SessionLocal() as db:  # type: Session
            rows = db.execute(
                select(Score.user_id, func.max(Score.score).label('best'), User.name, User.email)
                .join(User, User.id == Score.user_id)
                .group_by(Score.user_id, User.name, User.email)
                .order_by(func.max(Score.score).desc())
                .limit(20)
            ).mappings().all()
            return jsonify({"top": [dict(r) for r in rows]})

    # --- Static frontend (serve index.html and assets) ---
    @app.get('/')
    def serve_index():
        return send_from_directory(project_root, 'index.html')

    @app.get('/favicon.ico')
    def favicon():
        # No favicon provided; avoid noisy 404s
        return ('', 204)

    @app.get('/<path:filename>')
    def serve_static(filename):
        # Only serve files that actually exist in project root
        file_path = os.path.join(project_root, filename)
        if os.path.isfile(file_path):
            return send_from_directory(project_root, filename)
        return jsonify({"error": "not_found"}), 404

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "not_found"}), 404

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=PORT)
