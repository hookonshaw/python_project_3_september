import sqlite3
from datetime import datetime

from hash_password import hash_password
from fastapi import FastAPI, Depends, HTTPException, Response, Request
from pydantic import BaseModel
from typing import Optional
from starlette.responses import RedirectResponse
from starlette.templating import Jinja2Templates
from db_connect import Base, engine, get_db, get_admin_id
from fastapi.staticfiles import StaticFiles
from authx import AuthX,AuthXConfig
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
                    key="access_token", 
                    value=token,
                    httponly=True,
                    secure=False,  
                    samesite="lax",
                    path="/"  
                )
        connection.close()
        RedirectResponse(url="/static/index_admin.html", status_code=302)
        return {"access_token": token}
    raise HTTPException(status_code=401, detail="Неверный логин или пароль")


@app.get("/protected")
async def protected(request: Request, user=Depends(security.access_token_required)):
    print("User in protected:", user)
    if user:
        return RedirectResponse(url="/static/index_admin.html")
    else:
        return RedirectResponse(url="/static/index_a_merge_mortal.html")


@app.post("/add_events")
async def add_events(event_data: EventCreate, payload: TokenPayload = Depends(security.access_token_required)):
    # print(payload)
    try:
        admin_id = getattr(payload, "sub")
    except Exception as e:
        raise HTTPException(401, detail={"ID администратора не найден": str(e)}) from e

    # Валидация даты и времени
    try:
        datetime.strptime(event_data.event_date, "%Y-%m-%d")
        datetime.strptime(event_data.event_time, "%H:%M")
    except ValueError as e:
        print(f"Ошибка валидации даты/времени: {str(e)}")
        raise HTTPException(status_code=400, detail="Неверный формат даты или времени")

    try:
        conn = sqlite3.connect("events.db")
        if not conn:
            raise HTTPException(status_code=500, detail="Не удалось подключиться к БД")

        cursor = conn.cursor()
        # Логируем данные перед вставкой
        print(f"Данные события: {event_data.dict()}")
        print(f"Admin ID: {admin_id}")

        cursor.execute('''
        INSERT INTO events (
            event_name, event_date, event_time, description, color, 
            event_auditory, admin_id, link, format, organisator, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            event_data.event_name,
            event_data.event_date,
            event_data.event_time,
            event_data.description,
            event_data.color,
            event_data.event_auditory,
            admin_id,
            event_data.link,
            event_data.format,
            event_data.organizer,  # Важно: используется organizer
            event_data.status
        ))

        conn.commit()
        event_id = cursor.lastrowid
        conn.close()

        return {"status": "success", "event_id": event_id}

    except sqlite3.Error as e:
        print(f"Ошибка SQLite: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка базы данных: {str(e)}")
    except Exception as e:
        print(f"Неожиданная ошибка: {str(e)}")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")
