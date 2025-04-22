const monthYear = document.getElementById('month-year');
const calendarBody = document.getElementById('calendar-body');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');
const eventPanel = document.getElementById('event-panel');
const eventForm = document.getElementById('event-form');
const closePanelBtn = document.getElementById('close-panel');
const deleteBtn = document.getElementById('delete-event');

let currentDate = new Date();
let events = {}; // Временное хранилище событий

const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function renderCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  monthYear.textContent = `${months[month]}, ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = (firstDay.getDay() + 6) % 7;

  calendarBody.innerHTML = '';
  let row = document.createElement('tr');
  let cellCount = 0;

  for (let i = 0; i < startDay; i++) {
    row.appendChild(document.createElement('td'));
    cellCount++;
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const cell = document.createElement('td');
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cell.textContent = day;

    if (events[dateStr]) {
      const eventDiv = document.createElement('div');
      eventDiv.textContent = events[dateStr].type;
      eventDiv.style.fontSize = '12px';
      eventDiv.style.color = '#c18ee0';
      cell.appendChild(document.createElement('br'));
      cell.appendChild(eventDiv);
    }

    cell.addEventListener('click', () => openEventPanel(dateStr));
    row.appendChild(cell);
    cellCount++;

    if (cellCount % 7 === 0) {
      calendarBody.appendChild(row);
      row = document.createElement('tr');
    }
  }

  if (cellCount % 7 !== 0) {
    for (let i = cellCount % 7; i < 7; i++) {
      row.appendChild(document.createElement('td'));
    }
    calendarBody.appendChild(row);
  }
}

prevBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar(currentDate);
});

nextBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar(currentDate);
});

function openEventPanel(dateStr) {
  eventPanel.style.display = 'block';
  eventForm.date.value = dateStr;
  if (events[dateStr]) {
    for (const key in events[dateStr]) {
      if (eventForm[key]) eventForm[key].value = events[dateStr][key];
    }
    eventForm.edit.value = 'true';
    deleteBtn.style.display = 'inline-block';
  } else {
    eventForm.reset();
    eventForm.date.value = dateStr;
    eventForm.edit.value = 'false';
    deleteBtn.style.display = 'none';
  }
}

function closeEventPanel() {
  eventPanel.style.display = 'none';
}

closePanelBtn.addEventListener('click', closeEventPanel);

eventForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(eventForm);
  const data = Object.fromEntries(formData.entries());
  events[data.date] = data;
  closeEventPanel();
  renderCalendar(currentDate);
});

deleteBtn.addEventListener('click', () => {
  const date = eventForm.date.value;
  if (confirm('Удалить событие?')) {
    delete events[date];
    closeEventPanel();
    renderCalendar(currentDate);
  }
});

renderCalendar(currentDate);