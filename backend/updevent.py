from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from authx import AuthX, TokenPayload
import sqlite3
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

@router.put("/update_event/{event_id}")
async def update_event(
    event_id: int,
    event_data: EventUpdate,
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

    # Валидация даты и времени, если они предоставлены
    if event_data.event_date:
        try:
            datetime.strptime(event_data.event_date, "%Y-%m-%d")
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail="Неверный формат даты. Используйте ГГГГ-ММ-ДД"
            )
    
    if event_data.event_time:
        try:
            datetime.strptime(event_data.event_time, "%H:%M")
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail="Неверный формат времени. Используйте ЧЧ:ММ"
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

        # Проверяем существование события и что оно принадлежит текущему администратору
        cursor.execute("SELECT admin_id FROM events WHERE id = ?", (event_id,))
        event = cursor.fetchone()
        
        if not event:
            raise HTTPException(
                status_code=404,
                detail="Событие не найдено"
            )
        
        if event[0] != admin_id:
            raise HTTPException(
                status_code=403,
                detail="Недостаточно прав для изменения этого события"
            )

        # Подготавливаем данные для обновления
        update_fields = {}
        if event_data.event_name is not None:
            update_fields["event_name"] = event_data.event_name
        if event_data.event_date is not None:
            update_fields["event_date"] = event_data.event_date
        if event_data.event_time is not None:
            update_fields["event_time"] = event_data.event_time
        if event_data.description is not None:
            update_fields["description"] = event_data.description
        if event_data.color is not None:
            update_fields["color"] = event_data.color
        if event_data.event_auditory is not None:
            update_fields["event_auditory"] = event_data.event_auditory
        if event_data.link is not None:
            update_fields["link"] = event_data.link
        if event_data.format is not None:
            update_fields["format"] = event_data.format
        if event_data.organisator is not None:
            update_fields["organisator"] = event_data.organisator
        if event_data.status is not None:
            update_fields["status"] = event_data.status
        if event_data.participants_count is not None:
            update_fields["participants_count"] = event_data.participants_count
        if event_data.recurrence_pattern is not None:
            update_fields["recurrence_pattern"] = event_data.recurrence_pattern
        if event_data.recurrence_count is not None:
            update_fields["recurrence_count"] = event_data.recurrence_count

        # Если нечего обновлять
        if not update_fields:
            raise HTTPException(
                status_code=400,
                detail="Нет данных для обновления"
            )

        # Формируем SQL запрос
        set_clause = ", ".join([f"{field} = ?" for field in update_fields])
        values = list(update_fields.values())
        values.append(event_id)

        cursor.execute(
            f"UPDATE events SET {set_clause} WHERE id = ?",
            values
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Событие не найдено или не было изменено"
            )

        conn.commit()
        conn.close()

        return {
            "status": "success",
            "message": "Событие успешно обновлено",
            "event_id": event_id,
            "updated_fields": list(update_fields.keys())
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