const monthYear = document.getElementById('month-year');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const eventPanel = document.getElementById('event-panel');
const eventForm = document.getElementById('event-form');
const closePanelBtn = document.getElementById('close-panel');
const deleteBtn = document.getElementById('delete-event');
const editBtn = document.getElementById('edit-event');
const notificationIcon = document.getElementById('notification-icon');
const notificationCount = document.getElementById('notification-count');
const notificationList = document.getElementById('notification-list');
const generateDescriptionBtn = document.getElementById('generate-description-btn');
const themeToggle = document.getElementById('theme-toggle'); // Переключатель темы

let currentDate = new Date();
let currentView = 'month';
let events = {};
let currentEventId = null;
let notifications = [];

const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

// Инициализация календаря
function initCalendar() {
  setupEventListeners();
  renderView();
  updateNotificationUI();
  loadEventsFromServer();
  checkUpcomingEvents();
  setInterval(checkUpcomingEvents, 5 * 60 * 1000);
  initTheme(); // Инициализация темы
}

// Инициализация темы
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
}

// Переключение темы
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️';
}

// Загрузка событий с сервера
async function loadEventsFromServer() {
  try {
    const response = await fetch('/get_events', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Ошибка загрузки событий');

    const serverEvents = await response.json();
    events = processServerEvents(serverEvents);
    renderView();
  } catch (error) {
    console.error('Ошибка загрузки событий:', error);
    addNotification('Не удалось загрузить события');
  }
}

// Конвертация событий с сервера
function processServerEvents(serverEvents) {
  const processed = {};
  const eventsArray = serverEvents.events || serverEvents;

  if (!Array.isArray(eventsArray)) {
    console.error('serverEvents.events не является массивом:', eventsArray);
    return processed;
  }

  eventsArray.forEach(event => {
    const dateStr = event.event_date;
    if (!processed[dateStr]) processed[dateStr] = [];
    processed[dateStr].push({
      id: event.id,
      event_name: event.event_name,
      event_date: event.event_date,
      event_time: event.event_time,
      event_auditory: event.event_auditory,
      description: event.description || '',
      organisator: event.organisator || '',
      color: event.color || '#dca9f2',
      link: event.link || '',
      format: event.format || '',
      status: event.status || '',
      participants_count: event.participants_count || null,
      recurrence_pattern: event.recurrence_pattern || 'none',
      recurrence_count: event.recurrence_count || 1
    });
  });
  return processed;
}

// Проверка конфликтов
function hasConflicts(dateStr, event_time, event_auditory, excludeEventId = null) {
  if (!events[dateStr]) return false;

  const [hour, minute] = event_time.split(':').map(Number);
  const eventTime = hour * 60 + minute;

  return events[dateStr].some(event => {
    if (excludeEventId && event.id === excludeEventId) return false;

    const [eventHour, eventMinute] = event.event_time.split(':').map(Number);
    const existingTime = eventHour * 60 + eventMinute;

    const hasAuditoryConflict = event_auditory && event.event_auditory && event.event_auditory === event_auditory;
    const isTimeConflict = Math.abs(existingTime - eventTime) < 60;

    if (hasAuditoryConflict && isTimeConflict) {
      console.log(`Конфликт обнаружен: событие "${event.event_name}" в ${event.event_time}, аудитория ${event.event_auditory}`);
    }

    return hasAuditoryConflict && isTimeConflict;
  });
}

// Отправка нового события на сервер
async function saveEventToServer(eventData) {
  if (hasConflicts(eventData.event_date, eventData.event_time, eventData.event_auditory, eventData.id)) {
    throw new Error('Конфликт: событие в это время уже существует в указанной аудитории');
  }

  try {
    const response = await fetch('/add_events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify({
        event_name: eventData.event_name,
        event_date: eventData.event_date,
        event_time: eventData.event_time,
        event_auditory: eventData.event_auditory,
        description: eventData.description,
        organisator: eventData.organisator,
        format: eventData.format,
        status: eventData.status,
        color: eventData.color,
        link: eventData.link,
        participants_count: eventData.participants_count ? parseInt(eventData.participants_count) : null,
        recurrence_pattern: eventData.recurrence_pattern,
        recurrence_count: eventData.recurrence_count ? parseInt(eventData.recurrence_count) : 1
      }),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Ошибка сервера');
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    throw error;
  }
}

// Обновление события на сервере
async function updateEventOnServer(eventData) {
  try {
    const eventId = parseInt(eventData.id, 10);
    if (isNaN(eventId)) {
      throw new Error('id должен быть числом');
    }

    if (!eventData.event_name || !eventData.event_date || !eventData.event_time) {
      throw new Error('Обязательные поля (event_name, event_date, event_time) должны быть заполнены');
    }

    const normalizeField = (value) => (value && value.trim() !== '' ? value : null);

    const requestBody = {
      id: eventId,
      event_name: eventData.event_name,
      event_date: eventData.event_date,
      event_time: eventData.event_time,
      description: normalizeField(eventData.description),
      color: normalizeField(eventData.color) || '#dca9f2',
      event_auditory: normalizeField(eventData.event_auditory),
      link: normalizeField(eventData.link),
      format: normalizeField(eventData.format),
      organisator: normalizeField(eventData.organisator),
      status: normalizeField(eventData.status),
      participants_count: eventData.participants_count ? parseInt(eventData.participants_count) : 0,
      recurrence_pattern: normalizeField(eventData.recurrence_pattern) || 'none',
      recurrence_count: eventData.recurrence_count ? parseInt(eventData.recurrence_count) : 1
    };
    console.log('Отправляемые данные на сервер:', JSON.stringify(requestBody));

    const response = await fetch('/update_event', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify(requestBody),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Статус ответа:', response.status);
      console.error('Полный текст ошибки:', errorText);
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || `Ошибка сервера (${response.status})`);
      } catch (parseError) {
        throw new Error(`Ошибка сервера (${response.status}): ${errorText}`);
      }
    }

    const responseData = await response.json();
    console.log('Ответ сервера:', responseData);
    return responseData;
  } catch (error) {
    console.error('Ошибка обновления:', error);
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
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify({
        event_name: event.event_name,
        event_date: dateStr,
        event_time: event.event_time,
        event_auditory: event.event_auditory
      }),
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Ошибка удаления');
    return await response.json();
  } catch (error) {
    console.error('Ошибка удаления:', error);
    throw error;
  }
}

// Генерация описания события
async function generateEventDescription() {
  try {
    const formData = new FormData(eventForm);
    const eventData = {
      event_name: formData.get('type'),
      event_organisator: formData.get('organizer') || '',
      event_auditory: formData.get('location') || '',
      event_date: formData.get('date'),
      event_time: formData.get('time')
    };

    if (!eventData.event_name || !eventData.event_date || !eventData.event_time) {
      throw new Error('Заполните обязательные поля: Тип, Дата и Время');
    }

    const response = await fetch('/generate_description', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify(eventData),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Ошибка генерации описания');
    }

    const result = await response.json();
    const descriptionField = document.getElementById('description');
    descriptionField.value = result.generated_description;
    if (currentEventId !== null && events[dateStr] && events[dateStr][currentEventId]) {
      events[dateStr][currentEventId].description = result.generated_description;
    }
    addNotification('Описание успешно сгенерировано');
  } catch (error) {
    console.error('Ошибка генерации описания:', error);
    addNotification('Не удалось сгенерировать описание: ' + error.message);
  }
}

// Drag and Drop
function initDragAndDrop() {
  document.addEventListener('dragstart', function(e) {
    if (e.target.classList.contains('event-block')) {
      console.log('Drag started:', e.target);
      const eventDiv = e.target;
      const dateStr = eventDiv.closest('[data-date]').dataset.date;
      const eventId = eventDiv.dataset.eventId;

      e.dataTransfer.setData('text/plain', JSON.stringify({
        dateStr,
        eventId
      }));
      eventDiv.style.opacity = '0.4';
    }
  });

  document.addEventListener('dragover', function(e) {
    if (e.target.closest('.calendar-table, .week-table, .day-grid, td, .hour-slot')) {
      console.log('Drag over:', e.target);
      e.preventDefault();
    }
  });

  document.addEventListener('drop', async function(e) {
    console.log('Drop event:', e);
    e.preventDefault();
    const dropTarget = e.target.closest('td, .hour-slot');
    if (!dropTarget) return;

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { dateStr: oldDateStr, eventId } = dragData;
      const event = events[oldDateStr][eventId];

      let newDateStr = dropTarget.dataset.date || formatDate(currentDate);
      let newTime = event.event_time;

      if (dropTarget.classList.contains('hour-slot')) {
        newTime = dropTarget.querySelector('.hour-label').textContent.replace(':00', ':00');
      }

      const updatedEvent = { ...event, event_date: newDateStr, event_time: newTime };

      await updateEventOnServer(updatedEvent);
      events[oldDateStr].splice(eventId, 1);
      if (!events[newDateStr]) events[newDateStr] = [];
      events[newDateStr].push(updatedEvent);

      addNotification('Событие перемещено');
      renderView();
    } catch (error) {
      console.error('Ошибка перемещения:', error);
      addNotification('Ошибка перемещения события: ' + error.message);
    }
  });
}

// Проверка предстоящих событий
function checkUpcomingEvents() {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  Object.entries(events).forEach(([dateStr, dayEvents]) => {
    const eventDate = new Date(dateStr);

    dayEvents.forEach(event => {
      const [hours, minutes] = event.event_time.split(':').map(Number);
      eventDate.setHours(hours, minutes, 0, 0);

      if (eventDate > now && eventDate <= oneHourLater &&
          !notifications.some(n => n.includes(`Скоро событие: ${event.event_name}`))) {
        addNotification(`Скоро событие: ${event.event_name} в ${event.event_time}`);
      }
    });
  });
}

// Рендеринг представлений
function renderView() {
  document.querySelectorAll('.view-container').forEach(view => {
    view.classList.add('hidden');
  });
  document.getElementById(`${currentView}-view`).classList.remove('hidden');

  switch(currentView) {
    case 'month': renderMonthView(); break;
    case 'week': renderWeekView(); break;
    case 'day': renderDayView(); break;
  }
}

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

  for (let i = 0; i < startDay; i++) {
    row.appendChild(document.createElement('td'));
    cellCount++;
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const cell = document.createElement('td');
    const date = new Date(year, month, day);
    const dateStr = formatDate(date);
    cell.dataset.date = dateStr;

    cell.textContent = day;
    if (events[dateStr]) {
      events[dateStr].forEach((event, index) => {
        const eventDiv = document.createElement('div');
        eventDiv.className = `event-block ${event.recurrence_pattern !== 'none' ? 'recurring-event' : ''} 
                            ${hasConflicts(dateStr, event.event_time, event.event_auditory, event.id) ? 'conflict-event' : ''}`;
        eventDiv.textContent = `${event.event_name} (${event.event_time})`;
        eventDiv.dataset.eventId = index;
        eventDiv.draggable = true;

        if (!hasConflicts(dateStr, event.event_time, event.event_auditory, event.id)) {
          eventDiv.style.backgroundColor = event.color || '#dca9f2';
        }

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

  while (cellCount % 7 !== 0) {
    row.appendChild(document.createElement('td'));
    cellCount++;
  }
  if (row.cells.length > 0) monthBody.appendChild(row);
}

function renderWeekView() {
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1);

  monthYear.textContent = `Неделя ${weekStart.getDate()}-${weekStart.getDate() + 6} ${months[weekStart.getMonth()]}`;

  const weekHeader = document.getElementById('week-header');
  const weekBody = document.getElementById('week-body');
  weekHeader.innerHTML = '';
  weekBody.innerHTML = '';

  let headerRow = document.createElement('tr');
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const th = document.createElement('th');
    th.textContent = `${daysOfWeek[i].slice(0, 3)} ${day.getDate()}`;
    headerRow.appendChild(th);
  }
  weekHeader.appendChild(headerRow);

  for (let hour = 8; hour < 20; hour++) {
    const row = document.createElement('tr');
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const dateStr = formatDate(day);
      const td = document.createElement('td');
      td.dataset.date = dateStr;

      if (events[dateStr]) {
        events[dateStr].forEach((event, index) => {
          const eventHour = parseInt(event.event_time.split(':')[0]);
          if (eventHour === hour) {
            const eventDiv = document.createElement('div');
            eventDiv.className = `event-block ${event.recurrence_pattern !== 'none' ? 'recurring-event' : ''} 
                                ${hasConflicts(dateStr, event.event_time, event.event_auditory, event.id) ? 'conflict-event' : ''}`;
            eventDiv.textContent = `${event.event_name} (${event.event_time})`;
            eventDiv.dataset.eventId = index;
            eventDiv.draggable = true;

            if (!hasConflicts(dateStr, event.event_time, event.event_auditory, event.id)) {
              eventDiv.style.backgroundColor = event.color || '#dca9f2';
            }

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

function renderDayView() {
  const dateStr = formatDate(currentDate);
  monthYear.textContent = `${currentDate.getDate()} ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  const dayGrid = document.getElementById('day-grid');
  dayGrid.innerHTML = '';

  for (let hour = 8; hour < 20; hour++) {
    const hourSlot = document.createElement('div');
    hourSlot.className = 'hour-slot';
    hourSlot.dataset.date = dateStr;
    hourSlot.innerHTML = `<div class="hour-label">${hour}:00</div>`;

    if (events[dateStr]) {
      events[dateStr].forEach((event, index) => {
        const eventHour = parseInt(event.event_time.split(':')[0]);
        if (eventHour === hour) {
          const eventDiv = document.createElement('div');
          eventDiv.className = `event-block ${event.recurrence_pattern !== 'none' ? 'recurring-event' : ''} 
                              ${hasConflicts(dateStr, event.event_time, event.event_auditory, event.id) ? 'conflict-event' : ''}`;
          eventDiv.textContent = `${event.event_name} (${event.event_time}, ${event.organisator})`;
          eventDiv.dataset.eventId = index;
          eventDiv.draggable = true;

          if (!hasConflicts(dateStr, event.event_time, event.event_auditory, event.id)) {
            eventDiv.style.backgroundColor = event.color || '#dca9f2';
          }

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

function openEventPanel(dateStr, eventId = null, hour = null) {
  eventPanel.style.display = 'block';
  eventForm.date.value = dateStr;
  currentEventId = eventId;

  const saveBtn = document.getElementById('save-event');
  const editBtn = document.getElementById('edit-event');
  const deleteBtn = document.getElementById('delete-event');

  if (eventId !== null && events[dateStr] && events[dateStr][eventId]) {
    const event = events[dateStr][eventId];
    eventForm.id.value = event.id || '';
    eventForm.type.value = event.event_name;
    eventForm.date.value = event.event_date;
    eventForm.time.value = event.event_time;
    eventForm.description.value = event.description || '';
    eventForm.color.value = event.color || '#dca9f2';
    eventForm.location.value = event.event_auditory || '';
    eventForm.link.value = event.link || '';
    eventForm.format.value = event.format || '';
    eventForm.organizer.value = event.organisator || '';
    eventForm.status.value = event.status || '';
    eventForm.participants.value = event.participants_count || '';
    eventForm.recurrence.value = event.recurrence_pattern || 'none';
    eventForm.recurrence_count.value = event.recurrence_count || 1;
    eventForm.edit.value = 'true';

    saveBtn.style.display = 'none';
    editBtn.style.display = 'inline-block';
    deleteBtn.style.display = 'inline-block';
  } else {
    eventForm.reset();
    eventForm.date.value = dateStr;
    eventForm.id.value = '';
    if (hour !== null) eventForm.time.value = `${hour}:00`;
    eventForm.recurrence_count.value = 1;
    eventForm.edit.value = 'false';

    saveBtn.style.display = 'inline-block';
    editBtn.style.display = 'none';
    deleteBtn.style.display = 'none';
  }
}

function addNotification(message) {
  if (!notifications.includes(message)) {
    notifications.push(message);
    updateNotificationUI();
  }
}

function updateNotificationUI() {
  notificationCount.textContent = notifications.length;
  notificationCount.classList.toggle('hidden', notifications.length === 0);

  notificationList.innerHTML = '';
  notifications.forEach(msg => {
    const item = document.createElement('div');
    item.className = 'notification-item';
    item.textContent = msg;
    notificationList.appendChild(item);
  });
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function setupEventListeners() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentView = this.dataset.view;
      renderView();
    });
  });

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

  closePanelBtn.addEventListener('click', () => {
    eventPanel.style.display = 'none';
  });

  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = eventForm.querySelector('#save-event');
    const originalText = submitBtn.textContent;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Сохранение...';

      const formData = new FormData(eventForm);
      const eventData = {
        id: formData.get('id') || null,
        event_name: formData.get('type'),
        event_date: formData.get('date'),
        event_time: formData.get('time'),
        description: formData.get('description') || null,
        color: formData.get('color') || '#dca9f2',
        event_auditory: formData.get('location') || null,
        link: formData.get('link') || null,
        format: formData.get('format') || null,
        organisator: formData.get('organizer') || null,
        status: formData.get('status') || null,
        participants_count: formData.get('participants') ? parseInt(formData.get('participants')) : null,
        recurrence_pattern: formData.get('recurrence') || 'none',
        recurrence_count: formData.get('recurrence_count') ? parseInt(formData.get('recurrence_count')) : 1,
        edit: formData.get('edit')
      };
      const dateStr = eventData.event_date;

      if (eventData.edit === 'true') {
        await updateEventOnServer(eventData);
        if (events[dateStr] && currentEventId !== null) {
          events[dateStr][currentEventId] = eventData;
        }
        addNotification(`Событие обновлено: ${eventData.event_name}`);
      } else {
        if (eventData.recurrence_pattern !== 'none' && eventData.recurrence_count > 1) {
          let currentEventDate = new Date(eventData.event_date);
          for (let i = 0; i < eventData.recurrence_count; i++) {
            const currentDateStr = formatDate(currentEventDate);
            const recurringEvent = { ...eventData, event_date: currentDateStr, id: null };

            await saveEventToServer(recurringEvent);

            if (!events[currentDateStr]) events[currentDateStr] = [];
            events[currentDateStr].push(recurringEvent);

            if (eventData.recurrence_pattern === 'daily') {
              currentEventDate.setDate(currentEventDate.getDate() + 1);
            } else if (eventData.recurrence_pattern === 'weekly') {
              currentEventDate.setDate(currentEventDate.getDate() + 7);
            } else if (eventData.recurrence_pattern === 'monthly') {
              currentEventDate.setMonth(currentEventDate.getMonth() + 1);
            }
          }
          addNotification(`Добавлено повторяющееся событие: ${eventData.event_name} (${eventData.recurrence_count} раз)`);
        } else {
          await saveEventToServer(eventData);
          if (!events[dateStr]) events[dateStr] = [];
          events[dateStr].push(eventData);
          addNotification(`Добавлено событие: ${eventData.event_name}`);
        }
      }

      eventPanel.style.display = 'none';
      renderView();
    } catch (error) {
      alert(`Ошибка: ${error.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  editBtn.addEventListener('click', async () => {
    const originalText = editBtn.textContent;

    try {
      editBtn.disabled = true;
      editBtn.textContent = 'Редактирование...';

      const formData = new FormData(eventForm);
      const eventData = {
        id: formData.get('id') || null,
        event_name: formData.get('type'),
        event_date: formData.get('date'),
        event_time: formData.get('time'),
        description: formData.get('description') || null,
        color: formData.get('color') || '#dca9f2',
        event_auditory: formData.get('location') || null,
        link: formData.get('link') || null,
        format: formData.get('format') || null,
        organisator: formData.get('organizer') || null,
        status: formData.get('status') || null,
        participants_count: formData.get('participants') ? parseInt(formData.get('participants')) : null,
        recurrence_pattern: formData.get('recurrence') || 'none',
        recurrence_count: formData.get('recurrence_count') ? parseInt(formData.get('recurrence_count')) : 1
      };
      const dateStr = eventData.event_date;

      await updateEventOnServer(eventData);
      if (events[dateStr] && currentEventId !== null) {
        events[dateStr][currentEventId] = eventData;
      }
      addNotification(`Событие обновлено: ${eventData.event_name}`);
      eventPanel.style.display = 'none';
      renderView();
    } catch (error) {
      alert(`Ошибка редактирования: ${error.message}`);
    } finally {
      editBtn.disabled = false;
      editBtn.textContent = originalText;
    }
  });

  deleteBtn.addEventListener('click', async () => {
    const dateStr = eventForm.date.value;
    if (!confirm('Удалить это событие?')) return;

    try {
      await deleteEventFromServer(dateStr, currentEventId);
      events[dateStr].splice(currentEventId, 1);
      if (events[dateStr].length === 0) delete events[dateStr];

      addNotification(`Удалено событие`);
      eventPanel.style.display = 'none';
      renderView();
    } catch (error) {
      alert(`Ошибка удаления: ${error.message}`);
    }
  });

  notificationIcon.addEventListener('click', () => {
    notificationList.classList.toggle('hidden');
  });

  document.querySelector('.user-icon-link').addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Клик по иконке пользователя');
    window.location.href = 'index_a_mere_mortal.html';
  });

  document.getElementById('logout-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      console.log('Ответ сервера:', response.status, response.redirected, response.url);

      if (response.redirected) {
        localStorage.removeItem('token');
      } else if (response.ok) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        const errorText = await response.text();
        throw new Error(`Ошибка при выходе: ${errorText}`);
      }
    } catch (error) {
      console.error('Ошибка выхода:', error);
      addNotification('Не удалось выйти из системы: ' + error.message);
    }
  });

  generateDescriptionBtn.addEventListener('click', async () => {
    await generateEventDescription();
  });

  // Обработчик переключения темы
  themeToggle.addEventListener('click', toggleTheme);

  initDragAndDrop();
}

// Запуск календаря
document.addEventListener('DOMContentLoaded', initCalendar);
