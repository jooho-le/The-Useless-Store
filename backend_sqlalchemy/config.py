import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv('PORT', '8080'))
DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
JWT_SECRET = os.getenv('JWT_SECRET', 'dev-secret')
CLIENT_ORIGIN = os.getenv('CLIENT_ORIGIN', '*')

# 프로젝트 루트(The-Useless-Store) 절대 경로
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# 로컬 편의: DATABASE_URL이 비어있으면 프로젝트 루트에 고정 경로로 SQLite 파일 사용
if not DATABASE_URL:
    db_path = os.path.join(PROJECT_ROOT, 'useless_store.db')
    # SQLAlchemy SQLite 절대경로 형식: sqlite:////absolute/path (Unix)
    # Windows도 'sqlite:///' + 절대경로 형태 지원
    DATABASE_URL = f"sqlite:///{db_path}"
