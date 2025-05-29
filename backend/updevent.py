from datetime import datetime
import sqlite3
from fastapi import Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

# Модель данных для обновления события (пример)
class EventUpdate(BaseModel):
    id: int  # Обязательное поле для идентификации события
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

@app.put("/update_event", tags=["DataBase"])
async def update_event(
        event_data: EventUpdate,
        admin_id: int = Depends(get_current_admin)):

    # Проверка форматов даты и времени
    if event_data.event_date:
        try:
            datetime.strptime(event_data.event_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Неверный формат даты. Используйте ГГГГ-ММ-ДД"
            )

    if event_data.event_time:
        try:
            datetime.strptime(event_data.event_time, "%H:%M")
        except ValueError:
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

        # 1. Проверяем существование события и права доступа
        cursor.execute("SELECT admin_id FROM events WHERE id = ?", (event_data.id,))
        event = cursor.fetchone()

        if not event:
            conn.close()
            raise HTTPException(
                status_code=404,
                detail="Событие не найдено"
            )

        if event[0] != admin_id:
            conn.close()
            raise HTTPException(
                status_code=403,
                detail="Недостаточно прав для изменения этого события"
            )

        # 2. Подготавливаем данные для обновления
        update_fields = {}
        update_values = []
        
        # Список полей для возможного обновления
        fields = [
            "event_name", "event_date", "event_time", "description",
            "color", "event_auditory", "link", "format",
            "organisator", "status", "participants_count",
            "recurrence_pattern", "recurrence_count"
        ]
        
        # Собираем только те поля, которые были переданы
        for field in fields:
            value = getattr(event_data, field)
            if value is not None:
                update_fields[field] = value
                update_values.append(value)

        # Если нечего обновлять
        if not update_fields:
            conn.close()
            return {"message": "Нет данных для обновления"}

        # 3. Формируем SQL-запрос
        set_clause = ", ".join([f"{field} = ?" for field in update_fields])
        update_values.append(event_data.id)  # Добавляем ID для WHERE
        
        sql = f"""
            UPDATE events
            SET {set_clause}
            WHERE id = ?
        """

        # 4. Выполняем обновление
        cursor.execute(sql, update_values)
        conn.commit()
        conn.close()

        return {"message": "Событие успешно обновлено"}

    except HTTPException:
        # Перехватываем уже обработанные ошибки
        raise
        
    except Exception as e:
        # Обработка любых других ошибок
        error_detail = f"Ошибка сервера при обновлении: {str(e)}"
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=error_detail)