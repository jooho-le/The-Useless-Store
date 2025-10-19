SQLAlchemy 백엔드 (Flask)
=========================

Flask + SQLAlchemy 기반의 API입니다. Docker 없이 로컬에서 간단히 실행할 수 있고, 기본은 SQLite 파일을 사용합니다. Postgres 사용도 환경변수 한 줄로 전환 가능합니다.

엔드포인트
- POST `/api/auth/signup` { email, password, name? } -> { token, user }
- POST `/api/auth/login` { email, password } -> { token, user }
- GET `/api/auth/me` (Bearer) -> { user }
- POST `/api/scores` (Bearer) { score } -> 201
- GET `/api/scores/my` (Bearer) -> { recent[], best }
- GET `/api/scores/leaderboard` -> { top[] }

로컬 실행(비도커)
1) 가상환경 생성 및 패키지 설치
   - `cd backend_sqlalchemy`
   - `python3 -m venv .venv`
   - `source .venv/bin/activate` (Windows: `.venv\\Scripts\\activate`)
   - `pip install -r requirements.txt`

2) 환경변수 설정
   - `cp .env.example .env`
   - 기본은 SQLite 파일(`useless_store.db`) 사용. Postgres 쓰려면 `.env`에 `DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/dbname` 추가

3) 서버 실행 (테이블은 자동 생성)
   - `python -m backend_sqlalchemy.app`
   - 헬스체크: `curl http://localhost:8080/api/health`

프런트 연결
- 이미 `The-Useless-Store/index.html`에 `window.API_BASE = 'http://localhost:8080/api'`가 설정되어 있습니다.
- 정적 서버로 띄우기(권장):
  - `npx serve The-Useless-Store -l 5173`
  - 브라우저에서 `http://localhost:5173`
- CORS 이슈가 있으면 `backend_sqlalchemy/.env`의 `CLIENT_ORIGIN`을 프런트 주소로 수정하세요.

배포 힌트
- SQLite 대신 Postgres를 사용하세요(`DATABASE_URL` 설정).
- Flask는 WSGI 서버(gunicorn 등) 뒤에서 실행하고, 포트/도메인에 맞춰 `CLIENT_ORIGIN`을 설정하세요.

