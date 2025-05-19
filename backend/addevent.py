from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from authx import AuthX
import sqlite3

router = APIRouter()

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
    rgb_color: Optional[str] = None

@router.post("/api/events")
async def create_event(
    event_data: EventCreate,
    request: Request,
    security: AuthX = Depends(AuthX)
):
    # Аутентификация
    try:
        payload = await security._get_payload_from_request(request)
        admin_id = payload.get("uid")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Не авторизован")

    # Валидация даты и времени
    try:
        datetime.strptime(event_data.event_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте ГГГГ-ММ-ДД")

    try:
        datetime.strptime(event_data.event_time, "%H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат времени. Используйте ЧЧ:ММ")

    # Создание события в БД
    try:
        conn = sqlite3.connect("events.db")
        cursor = conn.cursor()

        event_tuple = (
            event_data.event_name,
            event_data.event_date,
            event_data.event_time,
            event_data.description,
            event_data.color,
            event_data.event_auditory,
            admin_id,
            event_data.link,
            event_data.format,
            event_data.organisator,
            event_data.status,
            event_data.participants_count,
            event_data.recurrence_pattern,
            event_data.rgb_color
        )

        cursor.execute('''
            INSERT INTO events(
                event_name, event_date, event_time, description,
                color, event_auditory, admin_id, link,
                format, organisator, status,
                participants_count, recurrence_pattern, rgb_color
            )
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''', event_tuple)

        conn.commit()
        event_id = cursor.lastrowid
        conn.close()

        return {
            "status": "success",
            "event_id": event_id,
            "message": "Событие успешно создано"
        }

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка базы данных: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Неизвестная ошибка: {str(e)}"
        )