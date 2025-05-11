import sqlite3

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

SQLALCHEMY_DATABASE_URL = r"sqlite:///./admins.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_admin_id(log, password):
    with sqlite3.connect('admins.db') as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM admins WHERE name = ? AND password_hash = ?", (log, password))
        result = cursor.fetchone()
        return str(result[0]) if result else None
