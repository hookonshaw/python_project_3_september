from pydantic import BaseModel
from typing import Optional
from db_connect import Base
from sqlalchemy import Column, String, Integer


class Admin(Base):
    __tablename__ = "admins"
    id = Column(Integer, primary_key=True)
    username = Column(String(50))
    password_hash = Column(String(100))


class AdminsLoginSchema(BaseModel):
    username: str
    password: str


class EventCreate(BaseModel):
    event_name: str
    event_date: str
    event_time: str
    description: Optional[str] = None
    color: Optional[str] = None
    event_auditory: Optional[str] = None
    link: Optional[str] = None
    format: Optional[str] = None
    organisator: Optional[str] = None
    status: Optional[str] = None
    participants_count: Optional[int] = None
    recurrence_pattern: Optional[str] = None
    recurrence_count: Optional[int] = None


class GenDescription(BaseModel):
    event_name: str
    event_date: str
    event_time: str
    event_auditory: str
    event_organisator: str


class EventDelete(BaseModel):
    event_name: str
    event_date: str
    event_time: str


class EventUpdate(BaseModel):
    event_name: Optional[str] = None
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    event_auditory: Optional[str] = None
    link: Optional[str] = None
    format: Optional[str] = None
    organisator: Optional[str] = None
    status: Optional[str] = None
    participants_count: Optional[int] = None
    recurrence_pattern: Optional[str] = None
    recurrence_count: Optional[int] = None

