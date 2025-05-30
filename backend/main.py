import sqlite3
from datetime import datetime, timedelta
from hash_password import hash_password
from fastapi import FastAPI, Depends, HTTPException, Response, Request
from starlette.responses import RedirectResponse
from starlette.templating import Jinja2Templates
from starlette.middleware import Middleware
from db_connect import Base, engine, get_admin_id
from fastapi.staticfiles import StaticFiles
from authx import AuthX, AuthXConfig, TokenPayload
from fastapi.middleware.cors import CORSMiddleware
from models import AdminsLoginSchema, EventCreate, GenDescription, EventDelete, EventUpdate
from gigachat import GigaChat

app = FastAPI(
    middleware=[
        Middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    ]
)

NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
}

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="static")

config = AuthXConfig()
config.JWT_SECRET_KEY = "SECRET_TOKEN"
config.JWT_ACCESS_COOKIE_NAME = "access_token"
config.JWT_TOKEN_LOCATION = ["cookies"]
config.JWT_COOKIE_CSRF_PROTECT = False
config.JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=60)

security = AuthX(config=config)


def check_admin_id(admin_id):
    try:
        connection = sqlite3.connect('admins.db')
        cursor = connection.cursor()

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='admins'")
        if not cursor.fetchone():
            connection.close()
            raise HTTPException(status_code=500, detail="Таблица admins не существует в базе данных")

        # Проверка admin_id
        cursor.execute("SELECT id FROM admins WHERE id = ?", (admin_id,))
        result = cursor.fetchone()
        connection.close()

        if result:
            return True
        else:
            return False

    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Ошибка базы данных: {str(e)}")


async def get_current_admin(payload: TokenPayload = Depends(security.access_token_required)) -> int:
    try:
        admin_id = payload.sub
    except AttributeError:
        raise HTTPException(status_code=401, detail="ID администратора не найден в токене")

    if not check_admin_id(admin_id):
        raise HTTPException(status_code=401, detail="Пользователь не авторизован")
    return admin_id


@app.get("/")
async def main_page():
    return RedirectResponse(url="/static/index_a_mere_mortal.html", status_code=302)


@app.get("/admin")
async def admin_page(request: Request, admin_id: int = Depends(get_current_admin)):
    return RedirectResponse(url="/static/index_admin.html", status_code=302)


@app.get("/login")
async def login_page(request: Request):
    # Если пользователь уже авторизован, перенаправляем его на /admin
    try:
        admin_id = await get_current_admin()
        if admin_id:
            return RedirectResponse(url="/admin", status_code=302)
    except HTTPException:
        # Если не авторизован, показываем страницу логина
        pass
    return RedirectResponse(url="/static/index_reg.html", status_code=302)


Base.metadata.create_all(bind=engine)


@app.post("/login", tags=["Admin"], summary="Авторизацияя администратора")
async def login(creds: AdminsLoginSchema, response: Response):
    connection = sqlite3.connect('admins.db')
    cursor = connection.cursor()
    inp_username, inp_password = creds.username, hash_password(str(creds.password))
    cursor.execute("SELECT * FROM admins WHERE name=? AND password_hash=?", (inp_username, inp_password))
    result = cursor.fetchone()
    if result:
        token = security.create_access_token(uid=get_admin_id(inp_username, inp_password))
        response.set_cookie(
            key=config.JWT_ACCESS_COOKIE_NAME,
            value=token,
            httponly=True,
            secure=True, 
            samesite="lax",
            path="/",  
            max_age=3600
        )
        connection.close()
        return {"success": True}

    connection.close()
    raise HTTPException(status_code=401, detail="Неверный логин или пароль")


@app.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=config.JWT_ACCESS_COOKIE_NAME,
                           path="/",
                           secure=True,
                           samesite="lax",
                           httponly=True)
    return {"status": "ok"}


@app.post("/add_events", tags=["DataBase"])
async def add_events(event_data: EventCreate, admin_id: int = Depends(get_current_admin)):
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
            admin_id,  
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


@app.get("/get_events", tags=["DataBase"])
async def get_events():
    try:
        conn = sqlite3.connect("events.db")
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, event_name, event_date, event_time, description, color, event_auditory, 
                   link, format, organisator, status, participants_count, recurrence_pattern, recurrence_count 
            FROM events
        """)
        events = cursor.fetchall()

        # Преобразуем данные в список словарей
        result = []
        for event in events:
            result.append({
                "id": event[0],
                "event_name": event[1],
                "event_date": event[2],
                "event_time": event[3],
                "description": event[4],
                "color": event[5],
                "event_auditory": event[6],
                "link": event[7],
                "format": event[8],
                "organisator": event[9],  # Исправлено с "organizer" на "organisator"
                "status": event[10],
                "participants_count": event[11],
                "recurrence_pattern": event[12],
                "recurrence_count": event[13]
            })

        conn.close()
        return {"events": result}

    except sqlite3.Error as e:
        raise HTTPException(status_code=500,
                            detail=f"Ошибка БД: {str(e)}")


@app.delete("/delete_event", tags=["DataBase"])
def delete_event(event_data: EventDelete,
                 admin_id: int = Depends(get_current_admin)):
    try:
        conn = sqlite3.connect('events.db')
        curs = conn.cursor()
        curs.execute("""
                        SELECT id FROM events 
                        WHERE event_name = ? 
                        AND event_date = ? 
                        AND event_time = ? 
                        AND event_auditory = ?
                    """, (
            event_data.event_name,
            event_data.event_date,
            event_data.event_time,
            event_data.event_auditory
        ))

        result = curs.fetchone()
        conn.close()
        if result is None:
            print(f"Событие не найдено для: {event_data}")
            return False
        event_id = result[0]
    except Exception as e:
        raise HTTPException(status_code=404, detail={f"Событие не найдено: {str(e)}"}) from e
    print("Event_id: ", admin_id)
    try:
        connection = sqlite3.connect('events.db')
        cursor = connection.cursor()
        sql = "DELETE FROM events WHERE id = ?"
        cursor.execute(sql, (event_id,))
        connection.commit()
        connection.close()
        if cursor.rowcount > 0:
            print(f"Событие {event_id} успешно удалено.")
            return True
        else:
            print(f"Нет события {event_id}.")
            return False

    except sqlite3.Error as e:
        print(f"Ошибка при удалении события: {e}")
        return False


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

        # Проверяем существование события и права доступа
        cursor.execute("SELECT admin_id FROM events WHERE id = ?", (event_data.id,))
        event = cursor.fetchone()
        print(event[0], event)
        if not event:
            conn.close()
            raise HTTPException(
                status_code=404,
                detail="Событие не найдено")

        # Подготавливаем данные для обновления
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

        # Формируем SQL-запрос
        set_clause = ", ".join([f"{field} = ?" for field in update_fields])
        update_values.append(event_data.id)  # Добавляем ID для WHERE

        sql = f"""
            UPDATE events
            SET {set_clause}
            WHERE id = ?
        """

        # Выполняем обновление
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
        raise HTTPException(status_code=500, detail=error_detail)


@app.post("/generate_description", tags=["Events"], summary="Generate event description")
async def generate_description(
        event_data: GenDescription,
        admin_id: int = Depends(get_current_admin)):
    event_name = event_data.event_name
    organizator = event_data.event_organisator
    audience = event_data.event_auditory
    date = event_data.event_date
    time = event_data.event_time

    prompt = f"""
    Составь небольшое описание мероприятия "{event_name}".
    Организатором является {organizator}.
    Мероприятие будет в аудитории: {audience}.
    Дата и время мероприятия: {date} в {time}
    Пожалуйста, включи в описание его формат и аудиторию.
    Сделай описание привлекательным и мотивирующим для участников.
    Не добавляй и не выдумывай никакие факты, которые я тебе не сообщал. Описание должно состоять из 3 - 5 предложений. 
    Составь описание без переносов и каких-либо дополнительных символов, чтобы его можно было напрямую вставить в календарь.
    """
    try:

        with GigaChat(
                credentials="<access_key>", #получите свой ключ доступа на сайте разработчиков Cбера
                ca_bundle_file=r"C:\Users\danii\Downloads\russian_trusted_root_ca.cer") as giga:
            response = giga.chat(prompt)
            print(response)
            generated_description = response.choices[0].message.content

        return {"event_name": event_name,
                "generated_description": generated_description}

    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=500, detail=f"Ошибка обработки ответа от GigaChat: {str(e)}")


