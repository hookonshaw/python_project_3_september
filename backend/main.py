import sqlite3
from datetime import datetime, timedelta
import httpx
from hash_password import hash_password
from fastapi import FastAPI, Depends, HTTPException, Response, Request
from starlette.responses import RedirectResponse
from starlette.templating import Jinja2Templates
from db_connect import Base, engine, get_db, get_admin_id
from fastapi.staticfiles import StaticFiles
from authx import AuthX, AuthXConfig, RequestToken, TokenPayload
from fastapi.middleware.cors import CORSMiddleware
from models import AdminsLoginSchema, EventCreate, GenDescription, EventDelete, EventUpdate


app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="static")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def main_page():
    return RedirectResponse(url="/static/index_a_mere_mortal.html")

Base.metadata.create_all(bind=engine)


config = AuthXConfig()
config.JWT_SECRET_KEY = "SECRET_TOKEN"
config.JWT_ACCESS_COOKIE_NAME = "access_token"
config.JWT_TOKEN_LOCATION = ["cookies"]
config.JWT_COOKIE_CSRF_PROTECT = False
config.JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=60)

security = AuthX(config=config)


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
                    secure=False,  
                    samesite="lax",
                    path="/",  
                    max_age=3600
                )
        connection.close()
        RedirectResponse(url="/static/index_admin.html", status_code=302)
        return {"access_token": token}
    raise HTTPException(status_code=401, detail="Неверный логин или пароль")


@app.get("/protected", dependencies=[Depends(security.get_token_from_request)], )
def get_protected(payload: TokenPayload = Depends(security.access_token_required)):
     try:
         id = getattr(payload, "sub")
         return id
     except Exception as e:
          raise HTTPException(401, detail={"Unauthorised": str(e)}) from e


def check_admin_id(admin_id):
    try:
        connection = sqlite3.connect('admins.db')
        cursor = connection.cursor()

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='admins'")
        if not cursor.fetchone():
            connection.close()
            raise HTTPException(status_code=500, detail="Таблица admins не существует в базе данных")

        cursor.execute("SELECT id FROM admins WHERE id = ?", (admin_id,))
        result = cursor.fetchone()
        connection.close()

        if result:
            return True
        else:
            return False

    except sqlite3.Error as e:
        connection.close()
        raise HTTPException(status_code=500, detail=f"Ошибка базы данных: {str(e)}")


@app.post("/add_events", tags=["DataBase"])
async def add_events(event_data: EventCreate, payload: TokenPayload = Depends(security.access_token_required)):
    try:
        admin_id = getattr(payload, "sub")
        print("ADMIN: ", admin_id)
    except Exception as e:
        raise HTTPException(401, detail={"ID администратора не найден": str(e)}) from e
    if check_admin_id(admin_id):

        try:
            datetime.strptime(event_data.event_date, "%Y-%m-%d")
            datetime.strptime(event_data.event_time, "%H:%M")
        except ValueError as e:
            print(f"Ошибка валидации даты/времени: {str(e)}")
            raise HTTPException(
                status_code=400,
                detail="Неверный формат даты или времени. Используйте ГГГГ-ММ-ДД для даты и ЧЧ:ММ для времени"
            )

        if event_data.recurrence_pattern and event_data.recurrence_count is None:
            raise HTTPException(
                status_code=400,
                detail="Укажите количество повторений для периодического события"
            )

        try:
            conn = sqlite3.connect("events.db")
            cursor = conn.cursor()

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='events'")
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=500,
                    detail="Таблица events не существует"
                )

            cursor.execute("PRAGMA table_info(events)")
            columns = [col[1] for col in cursor.fetchall()]
            if "recurrence_count" not in columns:
                cursor.execute("ALTER TABLE events ADD COLUMN recurrence_count INTEGER")
                conn.commit()

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
    else:
        raise HTTPException(
                status_code=401,
                detail=f"Пользователь не авторизован!")


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
                "organisator": event[9],  
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
def delete_event(event_data: EventDelete,  payload: TokenPayload = Depends(security.access_token_required)):
    try:
        admin_id = getattr(payload, "sub")
        print("ADMIN: ", admin_id)
    except Exception as e:
        raise HTTPException(401, detail={"ID администратора не найден": str(e)}) from e
    if check_admin_id(admin_id):
        try:
            conn = sqlite3.connect('events.db')
            curs = conn.cursor()
            curs.execute("""
                            SELECT id FROM events 
                            WHERE event_name = ? 
                            AND event_date = ? 
                            AND event_time = ? 
                        """, (
                event_data.event_name,
                event_data.event_date,
                event_data.event_time,
            ))

            result = curs.fetchone()

            if result is None:
                conn.close()
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
    else:
        raise HTTPException(status_code=401,
                            detail=f"Пользователь не авторизован!")


@app.put("/update_event", tags=["DataBase"])
async def update_event(
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

    if event_data.recurrence_pattern and event_data.recurrence_count is None:
        raise HTTPException(
            status_code=400,
            detail="Укажите количество повторений для периодического события"
        )

    try:
        conn = sqlite3.connect("events.db")
        cursor = conn.cursor()
        cursor.execute("""
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

        result = cursor.fetchone()

        if result is None:
            conn.close()
            print(f"Событие не найдено для: {event_data}")
            return False
        event_id = result[0]
    except Exception as e:
        raise HTTPException(status_code=404, detail={f"Событие не найдено: {str(e)}"}) from e
    print("Event_id: ", admin_id)
    try:
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

        if not update_fields:
            raise HTTPException(
                status_code=400,
                detail="Нет данных для обновления")

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
                detail="Событие не найдено или не было изменено")
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
