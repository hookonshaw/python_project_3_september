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
