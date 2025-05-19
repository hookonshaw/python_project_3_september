from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from authx import AuthX, TokenPayload
import sqlite3

router = APIRouter()
security = AuthX()

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

@router.post("/add_events")
async def add_events(
    event_data: EventCreate,
    payload: TokenPayload = Depends(security.access_token_required)
):
    try:
        admin_id = payload.sub
        print("ADMIN ID:", admin_id)
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail={"message": "ID администратора не найден", "error": str(e)}
        ) from e

    # Валидация даты и времени
    try:
        datetime.strptime(event_data.event_date, "%Y-%m-%d")
        datetime.strptime(event_data.event_time, "%H:%M")
    except ValueError as e:
        print(f"Ошибка валидации даты/времени: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Неверный формат даты или времени. Используйте ГГГГ-ММ-ДД для даты и ЧЧ:ММ для времени"
        )

    # Валидация повторений
    if event_data.recurrence_pattern and event_data.recurrence_count is None:
        raise HTTPException(
            status_code=400,
            detail="Укажите количество повторений для периодического события"
        )

    try:
        conn = sqlite3.connect("events.db")
        cursor = conn.cursor()

        # Проверяем существование таблицы events
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='events'")
        if not cursor.fetchone():
            raise HTTPException(
                status_code=500,
                detail="Таблица events не существует"
            )

        # Проверяем наличие поля recurrence_count
        cursor.execute("PRAGMA table_info(events)")
        columns = [col[1] for col in cursor.fetchall()]
        if "recurrence_count" not in columns:
            cursor.execute("ALTER TABLE events ADD COLUMN recurrence_count INTEGER")
            conn.commit()

        # Подготовка данных
        event_tuple = (
            event_data.event_name,
            event_data.event_date,
            event_data.event_time,
            event_data.description,
            event_data.color,
            event_data.event_auditory,
            admin_id,  # Используем admin_id из токена
            event_data.link,
            event_data.format,
            event_data.organisator,
            event_data.status,
            event_data.participants_count,
            event_data.recurrence_pattern,
            event_data.recurrence_count
        )

        # Вставка данных
        cursor.execute('''
            INSERT INTO events(
                event_name, event_date, event_time, description,
                color, event_auditory, admin_id, link,
                format, organisator, status,
                participants_count, recurrence_pattern, recurrence_count
            )
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''', event_tuple)

        conn.commit()
        event_id = cursor.lastrowid
        conn.close()

        return {
            "status": "success",
            "event_id": event_id,
            "message": "Событие успешно создано",
            "admin_id": admin_id
        }

    except sqlite3.IntegrityError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Ошибка целостности данных: {str(e)}"
        )
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