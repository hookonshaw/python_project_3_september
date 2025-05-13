from db_connect import Base
from sqlalchemy import Column, String, Integer


class Admin(Base):
    __tablename__ = "admins"
    id = Column(Integer, primary_key=True)
    username = Column(String(50))
    password_hash = Column(String(100))  
