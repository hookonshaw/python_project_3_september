import sqlite3
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from hash_password import hash_password
from fastapi import FastAPI, Depends, HTTPException, Response, Request
from pydantic import BaseModel
from typing import Optional
from starlette.responses import RedirectResponse
from starlette.templating import Jinja2Templates
from db_connect import Base, engine, get_db, get_admin_id
from fastapi.staticfiles import StaticFiles
from authx import AuthX, AuthXConfig, RequestToken, TokenPayload
from fastapi.middleware.cors import CORSMiddleware


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

security = AuthX(config=config)


class AdminsLoginSchema(BaseModel):
    username: str
    password: str


@app.post("/login")
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
                    secure=False,  # Для теста False (в продакшене True)
                    samesite="lax",
                    path="/"  
                )

        connection.close()
        RedirectResponse(url="/static/index_admin.html", status_code=302)
        return {"access_token": token}
    raise HTTPException(status_code=401, detail="Неверный логин или пароль")


@app.get("/protected", dependencies=[Depends(security.get_token_from_request)])
def get_protected(payload: TokenPayload = Depends(security.access_token_required)):
     try:
         id = getattr(payload, "sub")
         return id
     except Exception as e:
          raise HTTPException(401, detail={"Unauthorised": str(e)}) from e


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


@app.post("/add_events")
async def add_events(event_data: EventCreate, payload: TokenPayload = Depends(security.access_token_required)):
    try:
        admin_id = getattr(payload, "sub")
    except Exception as e:
        raise HTTPException(401, detail={"ID администратора не найден": str(e)}) from e

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

        # проверка существование таблицы events
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='events'")
        if not cursor.fetchone():
            raise HTTPException(
                status_code=500,
                detail="Таблица events не существует"
            )

        # проверка наличие поля recurrence_count
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
            admin_id,  #!
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

@app.get("/get_events") # на данном этапе требует доработки
async def get_events():
    try:
        conn = sqlite3.connect("events.db")
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM events")
        events = cursor.fetchall()

        # Преобразуем в список словарей
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
                "admin_id": event[7],
                "link": event[8],
                "format": event[9],
                "organizer": event[10],
                "status": event[11]
            })

        conn.close()
        return {"events": result}

    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Ошибка БД: {str(e)}")



