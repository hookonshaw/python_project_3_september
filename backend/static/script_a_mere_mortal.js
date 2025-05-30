// Файл: script_a_mere_mortal.js

const monthYear = document.getElementById('month-year');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const eventViewPanel = document.getElementById('event-view-panel');
const closeViewPanelBtn = document.getElementById('close-view-panel');
const themeToggle = document.getElementById('theme-toggle');

let currentDate = new Date();
let currentView = 'month';
let events = {};

const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function initCalendar() {
  setupEventListeners();
  loadEventsFromServer();
  renderView();
  initTheme();
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️';
}

async function loadEventsFromServer() {
  try {
    const headers = {};
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/get_events', {
      headers: headers
    });

    if (!response.ok) throw new Error('Ошибка загрузки событий');

    const serverEvents = await response.json();
    events = processServerEvents(serverEvents);
    renderView();
  } catch (error) {
    console.error('Ошибка загрузки событий:', error);
    events = {};
    renderView();
  }
}

function processServerEvents(serverEvents) {
  const processed = {};
  const eventsArray = serverEvents.events || serverEvents;

  if (!Array.isArray(eventsArray)) {
    console.error('serverEvents.events не является массивом:', eventsArray);
    return processed;
  }

  eventsArray.forEach((event, index) => {
    const dateStr = event.event_date;
    const time = event.event_time || event.time;
    if (!/^\d{2}:\d{2}$/.test(time)) {
      console.warn(`Некорректный формат времени для события ${event.event_name || event.type}: ${time}`);
      return;
    }

    if (!processed[dateStr]) processed[dateStr] = [];
    const processedEvent = {
      id: event.id || index,
      type: event.event_name || 'Не указано',
      date: event.event_date || 'Не указано',
      time: time,
      format: event.format || '',
      organizer: event.organisator || '',
      location: event.event_auditory || '',
      description: event.description || '',
      color: event.color || '#dca9f2',
      recurrence_pattern: event.recurrence_pattern || 'none',
      recurrence_count: event.recurrence_count || 1
    };
    processed[dateStr].push(processedEvent);
    console.log(`Обработано событие на ${dateStr}:`, processedEvent);
  });
  return processed;
}

function hasConflicts(dateStr, event_time, event_auditory, excludeEventId = null) {
  if (!events[dateStr]) return false;

  const [hour, minute] = event_time.split(':').map(Number);
  const eventTime = hour * 60 + minute;

  return events[dateStr].some(event => {
    if (excludeEventId && event.id === excludeEventId) return false;

    const [eventHour, eventMinute] = event.time.split(':').map(Number);
    const existingTime = eventHour * 60 + eventMinute;

    const hasAuditoryConflict = event_auditory && event.location && event.location === event_auditory;
    const isTimeConflict = Math.abs(existingTime - eventTime) < 60;

    return hasAuditoryConflict && isTimeConflict;
  });
}

function setupEventListeners() {
  prevBtn.addEventListener('click', () => {
    updateDate(-1);
    renderView();
  });
  nextBtn.addEventListener('click', () => {
    updateDate(1);
    renderView();
  });
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      renderView();
    });
  });
  closeViewPanelBtn.addEventListener('click', () => {
    eventViewPanel.style.display = 'none';
  });
  themeToggle.addEventListener('click', toggleTheme);
}

function formatDate(date) {
  // Базовая реализация, если не определена
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateDate(direction) {
  // Базовая реализация, если не определена
  switch (currentView) {
    case 'month':
      currentDate.setMonth(currentDate.getMonth() + direction);
      break;
    case 'week':
      currentDate.setDate(currentDate.getDate() + direction * 7);
      break;
    case 'day':
      currentDate.setDate(currentDate.getDate() + direction);
      break;
  }
}

function renderView() {
  document.querySelectorAll('.view-container').forEach(view => {
    view.classList.add('hidden');
  });
  
  document.getElementById(`${currentView}-view`).classList.remove('hidden');

  switch(currentView) {
    case 'month':
      renderMonthView();
      break;
    case 'week':
      renderWeekView();
      break;
    case 'day':
      renderDayView();
      break;
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
    const dateStr = formatDate(new Date(year, month, day));

    cell.textContent = day;
    if (events[dateStr] && events[dateStr].length > 0) {
      events[dateStr].forEach((event, index) => {
        const eventDiv = document.createElement('div');
        eventDiv.className = `event-block ${event.recurrence_pattern !== 'none' ? 'recurring-event' : ''} 
                            ${hasConflicts(dateStr, event.time, event.location, event.id) ? 'conflict-event' : ''}`;
        eventDiv.textContent = `${event.type} (${event.time})`;
        eventDiv.style.backgroundColor = event.color || '#dca9f2';
        eventDiv.dataset.eventId = index;
        eventDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          console.log('Клик по событию:', event);
          showEventDetails(event);
        });
        cell.appendChild(eventDiv);
      });
    }

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
    th.textContent = `${daysOfWeek[i]} ${day.getDate()}`;
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

      if (events[dateStr]) {
        events[dateStr].forEach((event, index) => {
          const eventHour = parseInt(event.time.split(':')[0]);
          if (eventHour === hour) {
            const eventDiv = document.createElement('div');
            eventDiv.className = `event-block ${event.recurrence_pattern !== 'none' ? 'recurring-event' : ''} 
                                ${hasConflicts(dateStr, event.time, event.location, event.id) ? 'conflict-event' : ''}`;
            eventDiv.textContent = `${event.type} (${event.time})`;
            eventDiv.style.backgroundColor = event.color || '#dca9f2';
            eventDiv.dataset.eventId = index;
            eventDiv.addEventListener('click', (e) => {
              e.stopPropagation();
              console.log('Клик по событию:', event);
              showEventDetails(event);
            });
            td.appendChild(eventDiv);
          }
        });
      }

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
    hourSlot.innerHTML = `<div class="hour-label">${hour}:00</div>`;

    if (events[dateStr]) {
      events[dateStr].forEach((event, index) => {
        const [eventHour, eventMinute] = event.time.split(':').map(Number);
        if (eventHour === hour) {
          const eventDiv = document.createElement('div');
          eventDiv.className = `event-block ${event.recurrence_pattern !== 'none' ? 'recurring-event' : ''} 
                              ${hasConflicts(dateStr, event.time, event.location, event.id) ? 'conflict-event' : ''}`;
          eventDiv.textContent = `${event.type} (${event.time})`;
          eventDiv.style.backgroundColor = event.color || '#dca9f2';
          eventDiv.dataset.eventId = index;
          eventDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Клик по событию:', event);
            showEventDetails(event);
          });
          hourSlot.appendChild(eventDiv);
        }
      });
    }

    dayGrid.appendChild(hourSlot);
  }
}

function showEventDetails(event) {
  console.log('Открытие деталей события:', event);
  const eventPanel = document.getElementById('event-view-panel');
  console.log('eventPanel:', eventPanel);
  const viewType = document.getElementById('view-type');
  const viewFormat = document.getElementById('view-format');
  const viewDate = document.getElementById('view-date');
  const viewTime = document.getElementById('view-time');
  const viewOrganizer = document.getElementById('view-organizer');
  const viewLocation = document.getElementById('view-location');
  const viewDescription = document.getElementById('view-description');

  // Заполняем поля данными события
  viewType.textContent = event.type || 'Не указано';
  viewFormat.textContent = event.format || 'Не указано';
  viewDate.textContent = event.date || 'Не указано';
  viewTime.textContent = event.time || 'Не указано';
  viewOrganizer.textContent = event.organizer || 'Не указано';
  viewLocation.textContent = event.location || 'Не указано';
  viewDescription.textContent = event.description || 'Не указано';

  // Показываем панель
  eventPanel.style.display = 'block';
}

initCalendar();