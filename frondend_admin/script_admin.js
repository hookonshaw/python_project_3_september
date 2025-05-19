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

// Инициализация календаря
function initCalendar() {
  setupEventListeners();
  renderView();
  updateNotificationUI();
  loadEventsFromServer();
  checkUpcomingEvents();
  setInterval(checkUpcomingEvents, 5 * 60 * 1000); // Проверка каждые 5 минут
}

// Загрузка событий с сервера
async function loadEventsFromServer() {
  try {
    const response = await fetch('/get_events');
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
  serverEvents.forEach(event => {
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
      recurrence_count: event.recurrence_count || 1 // Добавляем recurrence_count
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

// Генерация повторяющихся событий
function generateRecurringEvents(eventData) {
  const eventsToSave = [eventData];
  const { recurrence_pattern, recurrence_count, event_date } = eventData;
  
  if (recurrence_pattern === 'none' || recurrence_count <= 1) return eventsToSave;

  const baseDate = new Date(event_date);
  
  for (let i = 1; i < recurrence_count; i++) {
    const newDate = new Date(baseDate);
    
    if (recurrence_pattern === 'daily') {
      newDate.setDate(baseDate.getDate() + i);
    } else if (recurrence_pattern === 'weekly') {
      newDate.setDate(baseDate.getDate() + i * 7);
    } else if (recurrence_pattern === 'monthly') {
      newDate.setMonth(baseDate.getMonth() + i);
    }
    
    const newDateStr = formatDate(newDate);
    
    const newEvent = {
      ...eventData,
      event_date: newDateStr,
      id: null // Новый ID будет присвоен сервером
    };
    
    eventsToSave.push(newEvent);
  }
  
  return eventsToSave;
}

// Отправка события на сервер
async function saveEventToServer(eventData) {
  if (hasConflicts(eventData.event_date, eventData.event_time, eventData.event_auditory, eventData.id)) {
    throw new Error('Конфликт: событие в это время уже существует в указанной аудитории');
  }

  try {
    console.log('Отправляемые данные:', eventData); // Отладка
    const response = await fetch('/add_events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
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
        recurrence_count: eventData.recurrence_count || 1 // Добавляем recurrence_count
      })
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
        event_name: event.event_name,
        event_date: dateStr,
        event_time: event.event_time
      })
    });

    if (!response.ok) throw new Error('Ошибка удаления');
    return await response.json();
  } catch (error) {
    console.error('Ошибка удаления:', error);
    throw error;
  }
}

// Drag and Drop
function initDragAndDrop() {
  document.addEventListener('dragstart', function(e) {
    if (e.target.classList.contains('event-block')) {
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

  document.addEventListener('dragend', function(e) {
    if (e.target.classList.contains('event-block')) {
      e.target.style.opacity = '1';
    }
  });

  document.addEventListener('dragover', function(e) {
    if (e.target.closest('.calendar-table, .week-table, .day-grid, td, .hour-slot')) {
      e.preventDefault();
    }
  });

  document.addEventListener('drop', async function(e) {
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
      
      if (hasConflicts(newDateStr, newTime, updatedEvent.event_auditory, event.id)) {
        addNotification('Конфликт: событие не может быть перемещено');
        return;
      }

      await deleteEventFromServer(oldDateStr, eventId);
      await saveEventToServer(updatedEvent);
      
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

  if (eventId !== null && events[dateStr] && events[dateStr][eventId]) {
    const event = events[dateStr][eventId];
    eventForm.type.value = event.event_name;
    eventForm.date.value = event.event_date;
    eventForm.time.value = event.event_time;
    eventForm.description.value = event.description;
    eventForm.color.value = event.color;
    eventForm.location.value = event.event_auditory;
    eventForm.link.value = event.link;
    eventForm.format.value = event.format;
    eventForm.organizer.value = event.organisator;
    eventForm.status.value = event.status;
    eventForm.participants.value = event.participants_count || '';
    eventForm.recurrence.value = event.recurrence_pattern;
    eventForm.recurrence_count.value = event.recurrence_count || 1; // Добавляем recurrence_count
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
    const submitBtn = eventForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Сохранение...';

      const formData = new FormData(eventForm);
      const eventData = {
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
        edit: formData.get('edit'),
        id: formData.get('id') || null
      };

      const eventsToSave = generateRecurringEvents(eventData);

      for (const event of eventsToSave) {
        const dateStr = event.event_date;
        await saveEventToServer(event);

        if (!events[dateStr]) events[dateStr] = [];
        if (event.id) {
          const index = events[dateStr].findIndex(e => e.id === event.id);
          if (index !== -1) events[dateStr][index] = event;
        } else {
          events[dateStr].push(event);
        }
      }

      addNotification(`Добавлено событие: ${eventData.event_name}`);
      eventPanel.style.display = 'none';
      renderView();
    } catch (error) {
      alert(`Ошибка сохранения: ${error.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
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
    window.location.href = 'index_reg.html';
  });

  initDragAndDrop();
}

// Запуск календаря
document.addEventListener('DOMContentLoaded', initCalendar);
