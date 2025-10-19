import datetime as dt
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
from .config import JWT_SECRET


def hash_password(pw: str) -> str:
    # 강제 PBKDF2-SHA256 사용: 일부 macOS Python 빌드에서 hashlib.scrypt 미지원 방지
    return generate_password_hash(pw, method='pbkdf2:sha256', salt_length=16)


def verify_password(hash_value: str, pw: str) -> bool:
    return check_password_hash(hash_value, pw)


def make_token(user) -> str:
    payload = {
        'sub': user.id,
        'email': user.email,
        'exp': dt.datetime.utcnow() + dt.timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def verify_token(token: str):
    return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
