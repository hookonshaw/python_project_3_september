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
      type: event.event_name,
      date: event.event_date,
      time: event.event_time,
      location: event.event_auditory,
      description: event.description || '',
      organizer: event.organisator || '',
      color: event.color || '#dca9f2', // Default color if none provided
      link: event.link || '',
      format: event.format || '',
      status: event.status || '',
      recurrence: event.recurrence || 'none',
      recurrence_count: event.recurrence_count || 1
    });
  });
  return processed;
}

// Проверка конфликтов
function hasConflicts(dateStr, time, location, excludeEventId = null) {
  if (!events[dateStr]) return false;
  
  const [hour, minute] = time.split(':').map(Number);
  const eventTime = hour * 60 + minute;
  
  return events[dateStr].some(event => {
    if (excludeEventId && event.id === excludeEventId) return false;
    
    const [eventHour, eventMinute] = event.time.split(':').map(Number);
    const existingTime = eventHour * 60 + eventMinute;
    
    return Math.abs(existingTime - eventTime) < 60 && 
           event.location === location;
  });
}

// Отправка события на сервер
async function saveEventToServer(eventData) {
  if (hasConflicts(eventData.date, eventData.time, eventData.location, eventData.id)) {
    throw new Error('Конфликт: событие в это время уже существует');
  }

  try {
    const response = await fetch('/add_events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        type: eventData.type,
        date: eventData.date,
        time: eventData.time,
        location: eventData.location,
        description: eventData.description,
        organisator: eventData.organizer,
        format: eventData.format,
        status: eventData.status,
        color: eventData.color,
        link: eventData.link,
        recurrence: eventData.recurrence,
        recurrence_count: eventData.recurrence_count
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
      let newTime = event.time;
      
      if (dropTarget.classList.contains('hour-slot')) {
        newTime = dropTarget.querySelector('.hour-label').textContent.replace(':00', ':00');
      }

      const updatedEvent = { ...event, date: newDateStr, time: newTime };
      
      if (hasConflicts(newDateStr, newTime, updatedEvent.location, event.id)) {
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
      const [hours, minutes] = event.time.split(':').map(Number);
      eventDate.setHours(hours, minutes, 0, 0);
      
      if (eventDate > now && eventDate <= oneHourLater && 
          !notifications.some(n => n.includes(`Скоро событие: ${event.type}`))) {
        addNotification(`Скоро событие: ${event.type} в ${event.time}`);
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
        eventDiv.className = `event-block ${event.recurrence !== 'none' ? 'recurring-event' : ''} 
                            ${hasConflicts(dateStr, event.time, event.location, event.id) ? 'conflict-event' : ''}`;
        eventDiv.textContent = `${event.type} (${event.time})`;
        eventDiv.dataset.eventId = index;
        eventDiv.draggable = true;
        eventDiv.style.backgroundColor = event.color; // Apply event-specific color
        
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
          const eventHour = parseInt(event.time.split(':')[0]);
          if (eventHour === hour) {
            const eventDiv = document.createElement('div');
            eventDiv.className = `event-block ${event.recurrence !== 'none' ? 'recurring-event' : ''} 
                                ${hasConflicts(dateStr, event.time, event.location, event.id) ? 'conflict-event' : ''}`;
            eventDiv.textContent = `${event.type} (${event.time})`;
            eventDiv.dataset.eventId = index;
            eventDiv.draggable = true;
            eventDiv.style.backgroundColor = event.color; // Apply event-specific color
            
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
        const eventHour = parseInt(event.time.split(':')[0]);
        if (eventHour === hour) {
          const eventDiv = document.createElement('div');
          eventDiv.className = `event-block ${event.recurrence !== 'none' ? 'recurring-event' : ''} 
                              ${hasConflicts(dateStr, event.time, event.location, event.id) ? 'conflict-event' : ''}`;
          eventDiv.textContent = `${event.type} (${event.time}, ${event.organizer})`;
          eventDiv.dataset.eventId = index;
          eventDiv.draggable = true;
          eventDiv.style.backgroundColor = event.color; // Apply event-specific color
          
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
    for (const key in event) {
      if (eventForm[key]) eventForm[key].value = event[key];
    }
    eventForm.edit.value = 'true';
    deleteBtn.style.display = 'inline-block';
  } else {
    eventForm.reset();
    eventForm.date.value = dateStr;
    if (hour !== null) eventForm.time.value = `${hour}:00`;
    eventForm.color.value = '#dca9f2'; // Set default color for new events
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
      const eventData = Object.fromEntries(formData.entries());
      const dateStr = eventData.date;

      await saveEventToServer(eventData);

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

  initDragAndDrop();
}

// Запуск календаря
document.addEventListener('DOMContentLoaded', initCalendar);
