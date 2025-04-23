const monthYear = document.getElementById('month-year');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const eventViewPanel = document.getElementById('event-view-panel');
const closeViewPanelBtn = document.getElementById('close-view-panel');

let currentDate = new Date();
let currentView = 'month';
let events = {};

const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Инициализация календаря
function initCalendar() {
  // Загрузка тестовых данных (в реальном приложении будет запрос к серверу)
  loadSampleEvents();
  setupEventListeners();
  renderView();
}

// Загрузка тестовых событий
function loadSampleEvents() {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  
  events = {};
}

// Основная функция рендеринга
function renderView() {
  // Скрываем все представления
  document.querySelectorAll('.view-container').forEach(view => {
    view.classList.add('hidden');
  });
  
  // Показываем активное представление
  document.getElementById(`${currentView}-view`).classList.remove('hidden');

  // Рендерим содержимое
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

// --- Месячный вид ---
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
    th.textContent = `${daysOfWeek[i]} ${day.getDate()}`;
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
        events[dateStr].forEach((event) => {
          const eventHour = parseInt(event.time.split(':')[0]);
          if (eventHour === hour) {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'event-block';
            eventDiv.textContent = `${event.type} (${event.time})`;
            eventDiv.addEventListener('click', (e) => {
              e.stopPropagation();
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
      events[dateStr].forEach((event) => {
        const eventHour = parseInt(event.time.split(':')[0]);
        if (eventHour === hour) {
          const eventDiv = document.createElement('div');
          eventDiv.className = 'event-block';
          eventDiv.textContent = `${event.type} (${event.organizer})`;
          eventDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            showEventDetails(event);
          });
          hourSlot.appendChild(eventDiv);
        }
      });
    }

    dayGrid.appendChild(hourSlot);
  }
}

// Показать детали события
function showEventDetails(event) {
  document.getElementById('view-type').textContent = event.type;
  document.getElementById('view-format').textContent = event.format === 'online' ? 'Онлайн' : 'Оффлайн';
  document.getElementById('view-date').textContent = event.date;
  document.getElementById('view-time').textContent = event.time;
  document.getElementById('view-organizer').textContent = event.organizer;
  document.getElementById('view-location').textContent = event.location || 'Не указано';
  document.getElementById('view-description').textContent = event.description || 'Нет описания';
  
  eventViewPanel.classList.remove('hidden');
}

// Закрыть панель просмотра
function closeEventViewPanel() {
  eventViewPanel.classList.add('hidden');
}

// Форматирование даты
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Настройка обработчиков событий
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

  // Закрытие панели просмотра
  closeViewPanelBtn.addEventListener('click', closeEventViewPanel);
}

// Запуск календаря
initCalendar();