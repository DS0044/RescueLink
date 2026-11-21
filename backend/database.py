"""Database connection and session management (PostgreSQL compatible SQLite)."""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from models import Base
from sqlalchemy import text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./rescuelink.db")

# For SQLite, connect_args is needed for multithreading
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
    if DATABASE_URL.startswith("sqlite"):
        with engine.connect() as conn:
            for col_name, col_type in [
                ("team_type", "INTEGER"),
                ("team_type_label", "VARCHAR(64)"),
                ("latest_note", "VARCHAR(255)"),
                ("delivery_status", "VARCHAR(32) DEFAULT 'delivered'"),
                ("retry_count", "INTEGER DEFAULT 0"),
                ("downlink_payload_hex", "VARCHAR(64)"),
                ("raw_downlink_hex", "TEXT"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE sos_reports ADD COLUMN {col_name} {col_type};"))
                    conn.commit()
                except Exception:
                    pass



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
