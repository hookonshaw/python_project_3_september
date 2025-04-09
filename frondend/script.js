const monthYear = document.getElementById('month-year');
const calendarBody = document.getElementById('calendar-body');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');

let currentDate = new Date();

const months = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

function renderCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  monthYear.textContent = `${months[month]}, ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = (firstDay.getDay() + 6) % 7; // сдвиг на понедельник

  calendarBody.innerHTML = '';
  let row = document.createElement('tr');
  let cellCount = 0;

  for (let i = 0; i < startDay; i++) {
    const cell = document.createElement('td');
    row.appendChild(cell);
    cellCount++;
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const cell = document.createElement('td');
    cell.textContent = day;
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

renderCalendar(currentDate);
