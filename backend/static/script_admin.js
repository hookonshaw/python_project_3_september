const monthYear = document.getElementById('month-year');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const eventPanel = document.getElementById('event-panel');
const eventForm = document.getElementById('event-form');
const closePanelBtn = document.getElementById('close-panel');
const deleteBtn = document.getElementById('delete-event');
const notificationIcon = document.getElementById('notification-icon');
const notificationCount = document.getElementById('notification-count');
const notificationList = document.getElementById('notification-list');

let currentDate = new Date();
let currentView = 'month';
let events = {};
let currentEventId = null;
let notifications = [];

const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

function renderView() {
  if (currentView === 'month') {
    renderMonthView();
  } else if (currentView === 'week') {
    renderWeekView();
  } else if (currentView === 'day') {
    renderDayView();
  }
}


// Инициализация календаря
function initCalendar() {
  setupEventListeners();
  renderView();
  updateNotificationUI();
  loadEventsFromServer(); // Загружаем события с сервера при старте
}

// Загрузка событий с сервера
async function loadEventsFromServer() {
  try {
    const response = await fetch('/get_events');
    if (!response.ok) throw new Error('Ошибка загрузки событий');

    const serverEvents = await response.json();
    events = processServerEvents(serverEvents); // Конвертируем в локальный формат
    renderView();
  } catch (error) {
    console.error('Ошибка загрузки событий:', error);
    addNotification('Не удалось загрузить события');
  }
}

// Конвертация событий с сервера в локальный формат
function processServerEvents(serverEvents) {
  const processed = {};
  serverEvents.forEach(event => {
    const dateStr = event.event_date;
    if (!processed[dateStr]) processed[dateStr] = [];

    processed[dateStr].push({
      type: event.event_name,
      date: event.event_date,
      time: event.event_time,
      location: event.event_auditory,
      description: event.description || '',
      organizer: event.organisator || '',
      color: event.color || '',          // Добавлено
      link: event.link || '',            // Добавлено
      format: event.format || '',        // Добавлено
      status: event.status || ''         // Добавлено
    });
  });
  return processed;
}

// Отправка события на сервер
async function saveEventToServer(eventData) {
  try {
    const response = await fetch('/add_events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        type: eventData.type,         // Важно: должно совпадать с alias в Pydantic модели
        date: eventData.date,
        time: eventData.time,
        location: eventData.location,
        description: eventData.description,
        organisator: eventData.organizer,  // Обратите внимание на поле!
        format: eventData.format,
        status: eventData.status,
        color: eventData.color,
        link: eventData.link
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Детали ошибки:", errorData);
      throw new Error(errorData.detail || 'Ошибка сервера');
    }

    return await response.json();
  } catch (error) {
    console.error('Полная ошибка:', error);
    throw error;
  }
}



// Удаление события с сервера
async function deleteEventFromServer(dateStr, eventId) {
  try {
    const event = events[dateStr][eventId];
    const response = await fetch(`/delete_event`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        event_name: event.type,
        event_date: dateStr,
        event_time: event.time
      })
    });

    if (!response.ok) throw new Error('Ошибка удаления');

    return await response.json();
  } catch (error) {
    console.error('Ошибка удаления:', error);
    throw error;
  }
}


// Обновленный обработчик формы
eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = eventForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Сохранение...';

    const formData = new FormData(eventForm);
    const eventData = Object.fromEntries(formData.entries());
    const dateStr = eventData.date;

    // Отправляем на сервер
    await saveEventToServer(eventData);

    // Обновляем локальные данные
    if (!events[dateStr]) events[dateStr] = [];

    if (currentEventId !== null) {
      events[dateStr][currentEventId] = eventData;
    } else {
      events[dateStr].push(eventData);
      addNotification(`Добавлено событие: ${eventData.type}`);
    }

    eventPanel.style.display = 'none';
    renderView();

  } catch (error) {
    alert(`Ошибка сохранения: ${error.message}`);
    console.error(error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

// Обновленный обработчик удаления
deleteBtn.addEventListener('click', async () => {
  const dateStr = eventForm.date.value;

  if (!confirm('Удалить это событие?')) return;

  try {
    await deleteEventFromServer(dateStr, currentEventId);

    // Обновляем локальные данные
    events[dateStr].splice(currentEventId, 1);
    if (events[dateStr].length === 0) delete events[dateStr];

    addNotification(`Удалено событие`);
    eventPanel.style.display = 'none';
    renderView();

  } catch (error) {
    alert(`Ошибка удаления: ${error.message}`);
    console.error(error);
  }
});

function renderMonthView() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = (firstDay.getDay() + 6) % 7;

  monthYear.textContent = `${months[month]} ${year}`;
  const monthBody = document.getElementById('month-body');
  monthBody.innerHTML = '';

  let row = document.createElement('tr');
  let cellCount = 0;

  // Пустые ячейки в начале месяца
  for (let i = 0; i < startDay; i++) {
    row.appendChild(document.createElement('td'));
    cellCount++;
  }

  // Ячейки с днями
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const cell = document.createElement('td');
    const dateStr = formatDate(new Date(year, month, day));

    cell.textContent = day;
    if (events[dateStr] && events[dateStr].length > 0) {
      events[dateStr].forEach((event, index) => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event-block';
        eventDiv.textContent = `${event.type} (${event.time})`;
        eventDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          openEventPanel(dateStr, index);
        });
        cell.appendChild(eventDiv);
      });
    }

    cell.addEventListener('click', () => openEventPanel(dateStr));
    row.appendChild(cell);
    cellCount++;

    if (cellCount % 7 === 0) {
      monthBody.appendChild(row);
      row = document.createElement('tr');
    }
  }

  // Пустые ячейки в конце месяца
  while (cellCount % 7 !== 0) {
    row.appendChild(document.createElement('td'));
    cellCount++;
  }
  if (row.cells.length > 0) monthBody.appendChild(row);
}

// --- Недельный вид ---
function renderWeekView() {
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Понедельник

  monthYear.textContent = `Неделя ${weekStart.getDate()}-${weekStart.getDate() + 6} ${months[weekStart.getMonth()]}`;

  const weekHeader = document.getElementById('week-header');
  const weekBody = document.getElementById('week-body');
  weekHeader.innerHTML = '';
  weekBody.innerHTML = '';


  // Заголовок с днями недели
  let headerRow = document.createElement('tr');
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const th = document.createElement('th');
    th.textContent = `${daysOfWeek[i].slice(0, 3)} ${day.getDate()}`;
    headerRow.appendChild(th);
  }
  weekHeader.appendChild(headerRow);

  // Тело таблицы (часы)
  for (let hour = 8; hour < 20; hour++) {
    const row = document.createElement('tr');
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const dateStr = formatDate(day);
      const td = document.createElement('td');

      if (events[dateStr]) {
        events[dateStr].forEach((event, index) => {
          const eventHour = parseInt(event.time.split(':')[0]);
          if (eventHour === hour) {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'event-block';
            eventDiv.textContent = `${event.type} (${event.time})`;
            eventDiv.addEventListener('click', (e) => {
              e.stopPropagation();
              openEventPanel(dateStr, index);
            });
            td.appendChild(eventDiv);
          }
        });
      }

      td.addEventListener('click', () => openEventPanel(dateStr, null, hour));
      row.appendChild(td);
    }
    weekBody.appendChild(row);
  }
}

// --- Дневной вид ---
function renderDayView() {
  const dateStr = formatDate(currentDate);
  monthYear.textContent = `${currentDate.getDate()} ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  const dayGrid = document.getElementById('day-grid');
  dayGrid.innerHTML = '';

  for (let hour = 8; hour < 20; hour++) {
    const hourSlot = document.createElement('div');
    hourSlot.className = 'hour-slot';
    hourSlot.innerHTML = `<div class="hour-label">${hour}:00</div>`;

    if (events[dateStr]) {
      events[dateStr].forEach((event, index) => {
        const eventHour = parseInt(event.time.split(':')[0]);
        if (eventHour === hour) {
          const eventDiv = document.createElement('div');
          eventDiv.className = 'event-block';
          eventDiv.textContent = `${event.type} (${event.time}, ${event.organizer})`;
          eventDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            openEventPanel(dateStr, index);
          });
          hourSlot.appendChild(eventDiv);
        }
      });
    }

    hourSlot.addEventListener('click', () => {
      openEventPanel(dateStr, null, hour);
      eventForm.time.value = `${hour}:00`;
    });
    dayGrid.appendChild(hourSlot);
  }
}

// --- Управление событиями ---
function openEventPanel(dateStr, eventId = null, hour = null) {
  eventPanel.style.display = 'block';
  eventForm.date.value = dateStr;
  currentEventId = eventId;

  if (eventId !== null && events[dateStr] && events[dateStr][eventId]) {
    const event = events[dateStr][eventId];
    for (const key in event) {
      if (eventForm[key]) eventForm[key].value = event[key];
    }
    eventForm.edit.value = 'true';
    deleteBtn.style.display = 'inline-block';
  } else {
    eventForm.reset();
    eventForm.date.value = dateStr;
    if (hour !== null) eventForm.time.value = `${hour}:00`;
    eventForm.edit.value = 'false';
    deleteBtn.style.display = 'none';
  }
}

function saveEvent(dateStr, eventData) {
  if (!events[dateStr]) events[dateStr] = [];

  if (currentEventId !== null) {
    events[dateStr][currentEventId] = eventData;
  } else {
    events[dateStr].push(eventData);
    addNotification(`Добавлено событие: ${eventData.type} (${dateStr} ${eventData.time})`);
  }
}

function deleteEvent(dateStr, eventId) {
  if (events[dateStr] && events[dateStr][eventId]) {
    events[dateStr].splice(eventId, 1);
    if (events[dateStr].length === 0) delete events[dateStr];
    addNotification(`Удалено событие с ${dateStr}`);
  }
}

// --- Уведомления ---
function addNotification(message) {
  notifications.push(message);
  updateNotificationUI();
}


function updateNotificationUI() {
  notificationCount.textContent = notifications.length;
  if (notifications.length > 0) {
    notificationCount.classList.remove('hidden');
  } else {
    notificationCount.classList.add('hidden');
  }

  notificationList.innerHTML = '';
  notifications.forEach(msg => {
    const item = document.createElement('div');
    item.className = 'notification-item';
    item.textContent = msg;
    notificationList.appendChild(item);
  });
}

// --- Вспомогательные функции ---
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// --- Обработчики событий ---
function setupEventListeners() {
  // Переключение видов
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentView = this.dataset.view;
      renderView();
    });
  });

  // Навигация
  prevBtn.addEventListener('click', () => {
    if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() - 1);
    else if (currentView === 'week') currentDate.setDate(currentDate.getDate() - 7);
    else currentDate.setDate(currentDate.getDate() - 1);
    renderView();
  });

  nextBtn.addEventListener('click', () => {
    if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + 1);
    else if (currentView === 'week') currentDate.setDate(currentDate.getDate() + 7);
    else currentDate.setDate(currentDate.getDate() + 1);
    renderView();
  });

  // Панель события
  closePanelBtn.addEventListener('click', () => {
    eventPanel.style.display = 'none';
  });

  eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(eventForm);
    const eventData = Object.fromEntries(formData.entries());
    saveEvent(eventData.date, eventData);
    eventPanel.style.display = 'none';
    renderView();
  });

  deleteBtn.addEventListener('click', () => {
    const dateStr = eventForm.date.value;
    if (confirm('Удалить это событие?')) {
      deleteEvent(dateStr, currentEventId);
      eventPanel.style.display = 'none';
      renderView();
    }
  });

  // Уведомления
  notificationIcon.addEventListener('click', () => {
    notificationList.classList.toggle('hidden');
  });
}

// Запуск календаря
initCalendar();
document.addEventListener('DOMContentLoaded', initCalendar);


//const monthYear = document.getElementById('month-year');
//const prevBtn = document.getElementById('prev-btn');
//const nextBtn = document.getElementById('next-btn');
//const eventPanel = document.getElementById('event-panel');
//const eventForm = document.getElementById('event-form');
//const closePanelBtn = document.getElementById('close-panel');
//const deleteBtn = document.getElementById('delete-event');
//const notificationIcon = document.getElementById('notification-icon');
//const notificationCount = document.getElementById('notification-count');
//const notificationList = document.getElementById('notification-list');
//
//let currentDate = new Date();
//let currentView = 'month';
//let events = {};
//let currentEventId = null;
//let notifications = [];
//
//const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
//  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
//
//const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
//
//// Инициализация календаря
//function initCalendar() {
//  setupEventListeners();
//  renderView();
//  updateNotificationUI();
//}
//
//// Основная функция рендеринга
//function renderView() {
//  console.log('Rendering view:', currentView);
//
//  // Скрываем все представления
//  document.querySelectorAll('.view-container').forEach(view => {
//    view.classList.add('hidden');
//  });
//
//  // Показываем активное представление
//  document.getElementById(`${currentView}-view`).classList.remove('hidden');
//
//  // Рендерим содержимое
//  switch(currentView) {
//    case 'month':
//      renderMonthView();
//      break;
//    case 'week':
//      renderWeekView();
//      break;
//    case 'day':
//      renderDayView();
//      break;
//  }
//}
//
//// --- Месячный вид ---
//function renderMonthView() {
//  const year = currentDate.getFullYear();
//  const month = currentDate.getMonth();
//  const firstDay = new Date(year, month, 1);
//  const lastDay = new Date(year, month + 1, 0);
//  const startDay = (firstDay.getDay() + 6) % 7;
//
//  monthYear.textContent = `${months[month]} ${year}`;
//  const monthBody = document.getElementById('month-body');
//  monthBody.innerHTML = '';
//
//  let row = document.createElement('tr');
//  let cellCount = 0;
//
//  // Пустые ячейки в начале месяца
//  for (let i = 0; i < startDay; i++) {
//    row.appendChild(document.createElement('td'));
//    cellCount++;
//  }
//
//  // Ячейки с днями
//  for (let day = 1; day <= lastDay.getDate(); day++) {
//    const cell = document.createElement('td');
//    const dateStr = formatDate(new Date(year, month, day));
//
//    cell.textContent = day;
//    if (events[dateStr] && events[dateStr].length > 0) {
//      events[dateStr].forEach((event, index) => {
//        const eventDiv = document.createElement('div');
//        eventDiv.className = 'event-block';
//        eventDiv.textContent = `${event.type} (${event.time})`;
//        eventDiv.addEventListener('click', (e) => {
//          e.stopPropagation();
//          openEventPanel(dateStr, index);
//        });
//        cell.appendChild(eventDiv);
//      });
//    }
//
//    cell.addEventListener('click', () => openEventPanel(dateStr));
//    row.appendChild(cell);
//    cellCount++;
//
//    if (cellCount % 7 === 0) {
//      monthBody.appendChild(row);
//      row = document.createElement('tr');
//    }
//  }
//
//  // Пустые ячейки в конце месяца
//  while (cellCount % 7 !== 0) {
//    row.appendChild(document.createElement('td'));
//    cellCount++;
//  }
//  if (row.cells.length > 0) monthBody.appendChild(row);
//}
//
//// --- Недельный вид ---
//function renderWeekView() {
//  const weekStart = new Date(currentDate);
//  weekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Понедельник
//
//  monthYear.textContent = `Неделя ${weekStart.getDate()}-${weekStart.getDate() + 6} ${months[weekStart.getMonth()]}`;
//
//  const weekHeader = document.getElementById('week-header');
//  const weekBody = document.getElementById('week-body');
//  weekHeader.innerHTML = '';
//  weekBody.innerHTML = '';
//
//  // Заголовок с днями недели
//  let headerRow = document.createElement('tr');
//  for (let i = 0; i < 7; i++) {
//    const day = new Date(weekStart);
//    day.setDate(weekStart.getDate() + i);
//    const th = document.createElement('th');
//    th.textContent = `${daysOfWeek[i].slice(0, 3)} ${day.getDate()}`;
//    headerRow.appendChild(th);
//  }
//  weekHeader.appendChild(headerRow);
//
//  // Тело таблицы (часы)
//  for (let hour = 8; hour < 20; hour++) {
//    const row = document.createElement('tr');
//    for (let i = 0; i < 7; i++) {
//      const day = new Date(weekStart);
//      day.setDate(weekStart.getDate() + i);
//      const dateStr = formatDate(day);
//      const td = document.createElement('td');
//
//      if (events[dateStr]) {
//        events[dateStr].forEach((event, index) => {
//          const eventHour = parseInt(event.time.split(':')[0]);
//          if (eventHour === hour) {
//            const eventDiv = document.createElement('div');
//            eventDiv.className = 'event-block';
//            eventDiv.textContent = `${event.type} (${event.time})`;
//            eventDiv.addEventListener('click', (e) => {
//              e.stopPropagation();
//              openEventPanel(dateStr, index);
//            });
//            td.appendChild(eventDiv);
//          }
//        });
//      }
//
//      td.addEventListener('click', () => openEventPanel(dateStr, null, hour));
//      row.appendChild(td);
//    }
//    weekBody.appendChild(row);
//  }
//}
//
//// --- Дневной вид ---
//function renderDayView() {
//  const dateStr = formatDate(currentDate);
//  monthYear.textContent = `${currentDate.getDate()} ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
//
//  const dayGrid = document.getElementById('day-grid');
//  dayGrid.innerHTML = '';
//
//  for (let hour = 8; hour < 20; hour++) {
//    const hourSlot = document.createElement('div');
//    hourSlot.className = 'hour-slot';
//    hourSlot.innerHTML = `<div class="hour-label">${hour}:00</div>`;
//
//    if (events[dateStr]) {
//      events[dateStr].forEach((event, index) => {
//        const eventHour = parseInt(event.time.split(':')[0]);
//        if (eventHour === hour) {
//          const eventDiv = document.createElement('div');
//          eventDiv.className = 'event-block';
//          eventDiv.textContent = `${event.type} (${event.time}, ${event.organizer})`;
//          eventDiv.addEventListener('click', (e) => {
//            e.stopPropagation();
//            openEventPanel(dateStr, index);
//          });
//          hourSlot.appendChild(eventDiv);
//        }
//      });
//    }
//
//    hourSlot.addEventListener('click', () => {
//      openEventPanel(dateStr, null, hour);
//      eventForm.time.value = `${hour}:00`;
//    });
//    dayGrid.appendChild(hourSlot);
//  }
//}
//
//// --- Управление событиями ---
//function openEventPanel(dateStr, eventId = null, hour = null) {
//  eventPanel.style.display = 'block';
//  eventForm.date.value = dateStr;
//  currentEventId = eventId;
//
//  if (eventId !== null && events[dateStr] && events[dateStr][eventId]) {
//    const event = events[dateStr][eventId];
//    for (const key in event) {
//      if (eventForm[key]) eventForm[key].value = event[key];
//    }
//    eventForm.edit.value = 'true';
//    deleteBtn.style.display = 'inline-block';
//  } else {
//    eventForm.reset();
//    eventForm.date.value = dateStr;
//    if (hour !== null) eventForm.time.value = `${hour}:00`;
//    eventForm.edit.value = 'false';
//    deleteBtn.style.display = 'none';
//  }
//}
//
//function saveEvent(dateStr, eventData) {
//  if (!events[dateStr]) events[dateStr] = [];
//
//  if (currentEventId !== null) {
//    events[dateStr][currentEventId] = eventData;
//  } else {
//    events[dateStr].push(eventData);
//    addNotification(`Добавлено событие: ${eventData.type} (${dateStr} ${eventData.time})`);
//  }
//}
//
//function deleteEvent(dateStr, eventId) {
//  if (events[dateStr] && events[dateStr][eventId]) {
//    events[dateStr].splice(eventId, 1);
//    if (events[dateStr].length === 0) delete events[dateStr];
//    addNotification(`Удалено событие с ${dateStr}`);
//  }
//}
//
//// --- Уведомления ---
//function addNotification(message) {
//  notifications.push(message);
//  updateNotificationUI();
//}
//
//function updateNotificationUI() {
//  notificationCount.textContent = notifications.length;
//  if (notifications.length > 0) {
//    notificationCount.classList.remove('hidden');
//  } else {
//    notificationCount.classList.add('hidden');
//  }
//
//  notificationList.innerHTML = '';
//  notifications.forEach(msg => {
//    const item = document.createElement('div');
//    item.className = 'notification-item';
//    item.textContent = msg;
//    notificationList.appendChild(item);
//  });
//}
//
//// --- Вспомогательные функции ---
//function formatDate(date) {
//  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
//}
//
//// --- Обработчики событий ---
//function setupEventListeners() {
//  // Переключение видов
//  document.querySelectorAll('.view-btn').forEach(btn => {
//    btn.addEventListener('click', function() {
//      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
//      this.classList.add('active');
//      currentView = this.dataset.view;
//      renderView();
//    });
//  });
//
//  // Навигация
//  prevBtn.addEventListener('click', () => {
//    if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() - 1);
//    else if (currentView === 'week') currentDate.setDate(currentDate.getDate() - 7);
//    else currentDate.setDate(currentDate.getDate() - 1);
//    renderView();
//  });
//
//  nextBtn.addEventListener('click', () => {
//    if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + 1);
//    else if (currentView === 'week') currentDate.setDate(currentDate.getDate() + 7);
//    else currentDate.setDate(currentDate.getDate() + 1);
//    renderView();
//  });
//
//  // Панель события
//  closePanelBtn.addEventListener('click', () => {
//    eventPanel.style.display = 'none';
//  });
//
//  eventForm.addEventListener('submit', (e) => {
//    e.preventDefault();
//    const formData = new FormData(eventForm);
//    const eventData = Object.fromEntries(formData.entries());
//    saveEvent(eventData.date, eventData);
//    eventPanel.style.display = 'none';
//    renderView();
//  });
//
//  deleteBtn.addEventListener('click', () => {
//    const dateStr = eventForm.date.value;
//    if (confirm('Удалить это событие?')) {
//      deleteEvent(dateStr, currentEventId);
//      eventPanel.style.display = 'none';
//      renderView();
//    }
//  });
//
//  // Уведомления
//  notificationIcon.addEventListener('click', () => {
//    notificationList.classList.toggle('hidden');
//  });
//}
//
//// Запуск календаря
//initCalendar();