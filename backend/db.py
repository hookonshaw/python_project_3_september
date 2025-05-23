import sqlite3
from datetime import datetime

def create_connection(db_file):
    """Создает соединение с базой данных SQLite"""
    conn = None
    try:
        conn = sqlite3.connect(db_file)
        return conn
    except sqlite3.Error as e:
        print(f"Ошибка подключения к базе данных: {e}")
    return conn

def add_event(conn, event_data):
    """
    Добавляет новое событие в таблицу events
    :param conn: соединение с базой данных
    :param event_data: кортеж с данными события (event_name, event_date, event_time, description, color, event_auditory, admin_id)
    :return: ID добавленного события
    """
    sql = '''INSERT INTO events(event_name, event_date, event_time, description, color, event_auditory, admin_id)
             VALUES(?,?,?,?,?,?,?)'''
    try:
        cursor = conn.cursor()
        cursor.execute(sql, event_data)
        conn.commit()
        return cursor.lastrowid
    except sqlite3.Error as e:
        print(f"Ошибка при добавлении события: {e}")
        return None

def del_event(conn, event_id):
    try:
        cursor = conn.cursor()
        sql = "DELETE FROM events WHERE id = ?"
        cursor.execute(sql, (event_id,))
        conn.commit()
        if cursor.rowcount > 0:
            print(f"Событие {event_id} успешно удалено.")
            return True
        else:
            print(f"Нет события {event_id}.")
            return False
    except sqlite3.Error as e:
        print(f"Ошибка при добавлении события: {e}")
        return False
    finally:
        if conn:
            conn.close()

def interactive_add_event(conn, admin_id):
    print("\nДобавление нового события:")
    event_name = input("Название события: ").strip()
    while not event_name:
        print("Название события обязательно!")
        event_name = input("Название события: ").strip()
    
    event_date = input("Дата события (ГГГГ-ММ-ДД): ").strip()
    while True:
        try:
            datetime.strptime(event_date, "%Y-%m-%d")
            break
        except ValueError:
            print("Неверный формат даты! Используйте ГГГГ-ММ-ДД")
            event_date = input("Дата события (ГГГГ-ММ-ДД): ").strip()
    
    event_time = input("Время события (ЧЧ:ММ): ").strip()
    while True:
        try:
            datetime.strptime(event_time, "%H:%M")
            break
        except ValueError:
            print("Неверный формат времени! Используйте ЧЧ:ММ")
            event_time = input("Время события (ЧЧ:ММ): ").strip()
    
    description = input("Описание (не обязательно): ").strip() or None
    color = input("Цвет (например, #FF0000 или 'red', не обязательно): ").strip() or None
    event_auditory = input("Аудитория (не обязательно): ").strip() or None
    
    event_data = (
        event_name,
        event_date,
        event_time,
        description,
        color,
        event_auditory,
        admin_id
    )
    
    event_id = add_event(conn, event_data)
    if event_id:
        print(f"\nСобытие успешно добавлено с ID: {event_id}")
    else:
        print("\nНе удалось добавить событие")

def main():
    database = "events.db"  # Имя файла базы данных
    admin_id = 1  # ID администратора (можно запрашивать при входе)
    conn = create_connection(database)
    if conn is not None:
        try:
            conn.execute("SELECT 1 FROM events LIMIT 1")
        except sqlite3.Error:
            print("Таблица events не существует или имеет другую структуру")
            conn.close()
            return
        while True:
            interactive_add_event(conn, admin_id)
            if input("\nДобавить еще одно событие? (y/n): ").lower() != 'y':
                break
        conn.close()
    else:
        print("Ошибка! Не удалось подключиться к базе данных.")

if __name__ == '__main__':
    main()