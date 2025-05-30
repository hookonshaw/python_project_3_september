# python_project_3_september
## 🏷Название команды: <br />
3 сентября <br />
## 📅Название проекта: <br /> 
Календарь мероприятий  института 8 "Компьютерные науки и прикладная математика" <br />

## 👥Состав команды: <br />
 **1. Бадамшин Даниил** [@CerN04](https://github.com/CerN04) - Backend Developer <br />
 **2. Шульц Ксения** [@ksenblet](https://github.com/ksenblet)- Team Lead & Tester <br />
 **3. Омаров Юсуп** [@hookonshaw](https://github.com/hookonshaw)- Frontend Developer <br /> 
 **4. Емельяненко Егор** [@Pom1dorKaA](https://github.com/Pom1dorKaA) - Backend Developer <br /> 
 **5. Чигрин Никита** [@pozercpp](https://github.com/pozercpp) - Backend Developer <br /> 
  
## 🎯Цель проекта:  <br />
Разработать и внедрить многофункциональный онлайн-календарь мероприятий для 8 института с возможностью публикации, гибкого управления событиями, интеграцией с внешними сервисами и расширенными настройками для повышения удобства планирования, минимизации конфликтов и автоматизации рутинных задач.

## 📋Задачи проекта: <br />
  **1.** Реализовать систему управления аккаунтами контент-менеджеров: <br />
          - Регистрация с хешированием паролей. <br />
          - Авторизация с проверкой учетных данных. <br />

  **2.** Разработать интерфейс создания событий: <br />
          - Форма с полями: название, тип события, формат (оффлайн/онлайн), организатор, локация, количество участников, статус(будущее/прошедшее), ссылка на                 регистрацию,     дата и время, описание события. <br />

  **3.** Обеспечить отображение событий в трех режимах: дневном, недельном, месячном. <br />

  **4.** Добавить функционал редактирования и удаления событий. <br />

  **5.** Внедрить механизм перетаскивания событий для изменения даты/времени. <br />

  **6.** Добавить проверку конфликтов: <br />
          - По времени и дате. <br />
          - По локации (например, если два события одновременно в одном помещении). <br />

  **7.** Реализовать периодичность событий: <br />
          - Настройка повторения (ежедневно, еженедельно, ежемесячно). <br />

  **8.** Настроить систему уведомлений: <br />
          - О предстоящих событиях. <br />
          - Об отмене или переносе событий. <br />

  **9.** Интегрировать календарь с GigaChat для автоматической генерации описаний событий: <br />
          - Пользователь вводит заголовок → ИИ формирует описание → возможность редактирования/отклонения. <br />

  **10.** Интегрировать базу данных SQLite: <br />
          - Хранение данных о событиях и пользователях. <br />
          - Обеспечение безопасности через хеширование паролей. <br />

## 📌Описание функционала календаря:
Неавторизованный пользователь: просмотр календаря, просмотр всей  информации о событиях, получение уведомлений о прошедших/предстоящих/отменённых мероприятиях.<br />

Авторизованный контент-менеджер: просмотр календаря, просмотр всей  информации о событиях, получение уведомлений о прошедших/предстоящих/отменённых мероприятиях, возможность создавать/редактировать/удалять события.

## 📊Технологический стек: <br />
[![Top Langs](https://github-readme-stats.vercel.app/api/top-langs/?username=hookonshaw&repo=python_project_3_september&theme=default&hide_title=true&width=1000&height=400)](https://github.com/hookonshaw/python_project_3_september)

## 📎Ссылки на ресурсы: <br />
[Ссылка на доску Miro](https://miro.com/welcomeonboard/TUxialhITllGVHgwQlZhVSt1Sy8zYnFnRUd0VkNyUFlHcU9kSG1mNU1VYjB4dWwvQ0xnQ3ZMVEN6ZXNTcG5lR2RQay9MRktEODJPb0IxOHVnOVcweC9CdzQ1K2NoNmkxRkdmblQvL2FuZCt0Q081Y3RiTyt5cWYzcXplU0tFcFN3VHhHVHd5UWtSM1BidUtUYmxycDRnPT0hdjE=?share_link_id=752528952253) <br />
[Ссылка на доску задач Yougile](https://ru.yougile.com/board/9caed9w4kp21) <br />
[Ссылка на презентацию](https://1drv.ms/p/c/c2a945d3d741da6d/ERgoWSlfzKNItSmq1BZYdgUBxfEVcCtPxa0C6F_ikbkhlQ) <br />

## ⚙️Запуск проекта:
  #### 1.Установка зависимостей:
  ```
  pip install -r requirements.txt
  npm install axios
 ```
  #### 2.Запуск сервера:
```
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
## 👀Демонстрация работы календаря: <br />
<div align="center">
  <h3>Главная страница(вид - месяц) </h3>
</div>

![image](https://github.com/user-attachments/assets/5da514d3-baf7-491f-89af-7df901912e3d)
 <br />

<div align="center">
  <h3>Главная страница(вид - неделя)</h3>
</div>

![image](https://github.com/user-attachments/assets/5d5b8c4a-dea1-4e0d-8235-66938bf90d3a)
 <br />

<div align="center">
  <h3>Главная страница(вид - день)</h3>
</div>

![image](https://github.com/user-attachments/assets/a2a19ac5-1209-4453-8c34-c94bbacb65d1)
 <br />

<div align="center">
  <h3>Страница авторизации для контент-менеджера</h3>
</div>


![image](https://github.com/user-attachments/assets/cadde711-17f2-4479-8113-d60bba0f5a70)
 <br />

<div align="center">
  <h3>Режим контент-менеджера, добавление событий (дневная тема)</h3>
</div>

![image](https://github.com/user-attachments/assets/7f23aafa-3a57-4e9a-9308-e42d1f531287)
 <br />





