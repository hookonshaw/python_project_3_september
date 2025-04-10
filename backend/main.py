import sqlite3
from fastapi import FastAPI, Depends, HTTPException, Response, Request
from pydantic import BaseModel
from starlette.templating import Jinja2Templates
from db_connect import Base, engine, get_db
from fastapi.staticfiles import StaticFiles
from authx import AuthX,AuthXConfig

from sqlalchemy.orm import Session
from models import Admin
import bcrypt


app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="static")


@app.get("/")
async def read_root():
    return RedirectResponse(url="/static/index.html")

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
    inp_username, inp_password = creds.username, creds.password
    cursor.execute("SELECT * FROM admins WHERE name=? AND password_hash=?", (inp_username, inp_password))
    result = cursor.fetchone()
    if result:
        print('Вход выполнен успешно!')
        token = security.create_access_token(uid=get_admin_id(inp_username, inp_password))
        response.set_cookie(config.JWT_ACCESS_COOKIE_NAME, token)
        connection.close()
        return {"access_token": token}
    raise HTTPException(status_code=401, detail="Неверный логин или пароль")


@app.get("/protected", dependencies=[Depends(security.access_token_required)])
async def protected():
    return {"message": "Пользователь авторизован!"}


def get_admin_id(log, password):
    with sqlite3.connect('admins.db') as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM admins WHERE name = ? AND password_hash = ?", (log, password))
        result = cursor.fetchone()
        return str(result[0]) if result else None




