from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings
from typing import Optional

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Pour cette démo, on utilise un utilisateur en mémoire
# En production, vous devriez utiliser Supabase Auth
DEMO_USER = {
    "id": 1,
    "email": "demo@example.com",
    "username": "demo_user",
    "hashed_password": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",  # "secret"
    "is_active": True,
    "created_at": "2024-01-01T00:00:00Z"
}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Pour cette démo, on retourne l'utilisateur demo
    if email == DEMO_USER["email"]:
        return DEMO_USER
    
    raise credentials_exception


@router.post("/register")
async def register(email: str, username: str, password: str):
    """Créer un nouvel utilisateur (démo)"""
    # Pour cette démo, on retourne toujours l'utilisateur demo
    return {
        "id": DEMO_USER["id"],
        "email": DEMO_USER["email"],
        "username": DEMO_USER["username"],
        "is_active": DEMO_USER["is_active"],
        "created_at": DEMO_USER["created_at"]
    }


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Connexion utilisateur (démo)"""
    # Pour cette démo, on accepte n'importe quel email/password
    # En production, vous devriez vérifier contre Supabase Auth
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    """Récupérer les informations de l'utilisateur connecté"""
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "username": current_user["username"],
        "is_active": current_user["is_active"],
        "created_at": current_user["created_at"]
    }

def get_current_user_optional(authorization: Optional[str] = Header(None)):
    """Authentification optionnelle pour la démo"""
    if not authorization:
        return None
    
    try:
        # Extraire le token du header Authorization: Bearer <token>
        if authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
        else:
            return None
            
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if email and email == DEMO_USER["email"]:
            return DEMO_USER
    except JWTError:
        pass
    
    return None
