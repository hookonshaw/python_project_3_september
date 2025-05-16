document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const eventData = {
        event_name: formData.get('event_name'),
        event_date: formData.get('event_date'),
        event_time: formData.get('event_time'),
        description: formData.get('description'),
        color: formData.get('color'), // Теперь цвет передается
        event_auditory: formData.get('location')
    };

    // Проверка обязательных полей
    if (!eventData.event_name ||
        !eventData.event_date ||
        !eventData.event_time) {
        document.getElementById('error-message').textContent = "Поля 'Название', 'Дата' и 'Время' обязательны";
        return;
    }

    // Валидация даты и времени
    try {
        new Date(eventData.event_date).toISOString();
        new Date(`2000-01-01T${eventData.event_time}`).toISOString();
    } catch (error) {
        document.getElementById('error-message').textContent = "Неверный формат даты или времени";
        return;
    }

    // Получение токена из куки
//    const token = getCookie('access_token');
//    if (!token) {
//        document.getElementById('error-message').textContent = "Вы не авторизованы";
//        return;
//    }

    // Отправка данных
    try {
        const response = await fetch('/add_events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(eventData)
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('error-message').textContent = `Событие добавлено! ID: ${data.event_id}`;
            form.reset();
            updateCalendar();
        } else {
            const errorData = await response.json();
            document.getElementById('error-message').textContent = errorData.detail || 'Ошибка';
        }
    } catch (error) {
        document.getElementById('error-message').textContent = "Ошибка при отправке данных";
    }
});

// Вспомогательные функции
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop().split(';').shift() : null;
}

function updateCalendar() {
    // Реализуйте обновление календаря (например, перезагрузка страницы)
    location.reload();
}

//document.getElementById('event-form').addEventListener('submit', async (e) => {
//    e.preventDefault(); // Предотвращаем стандартную отправку формы
//
//    // Собираем данные из формы
//    const formData = new FormData(e.target);
//    const eventData = {
//        event_name: formData.get('type'),          // Имя события (из поля type)
//        event_date: formData.get('date'),          // Дата (формат ГГГГ-ММ-ДД)
//        event_time: formData.get('time'),          // Время (формат ЧЧ:ММ)
//        description: formData.get('description'),  // Описание
//        color: null,                              // Цвет (если не указано)
//        event_auditory: formData.get('location')   // Аудитория (из поля location)
//    };
//
//    // Проверка обязательных полей
//    if (!eventData.event_name ||
//        !eventData.event_date ||
//        !eventData.event_time) {
//        alert("Поля 'Тип', 'Дата' и 'Время' обязательны для заполнения");
//        return;
//    }
//
//    // Валидация даты и времени (дополнительно к HTML5)
//    try {
//        // Проверка даты
//        new Date(eventData.event_date).toISOString();
//        // Проверка времени
//        new Date(`2000-01-01T${eventData.event_time}`).toISOString();
//    } catch (error) {
//        alert("Неверный формат даты или времени");
//        return;
//    }
//
//    // Отправка данных через fetch
//    try {
//        const response = await fetch('/add_events', {
//            method: 'POST',
//            headers: {
//                'Content-Type': 'application/json',
//                'Authorization': `Bearer ${getCookie('access_token')}` // Если токен в cookie
//            },
//            body: JSON.stringify(eventData)
//        });
//
//        if (response.ok) {
//            const data = await response.json();
//            alert(`Событие добавлено! ID события: ${data.event_id}`);
//            e.target.reset(); // Очищаем форму
//            updateCalendar(); // Перезагрузка календаря (нужно реализовать эту функцию)
//        } else {
//            const errorData = await response.json();
//            alert(`Ошибка: ${errorData.detail}`);
//        }
//    } catch (error) {
//        alert("Произошла ошибка при добавлении события");
//        console.error(error);
//    }
//});
//
//// Вспомогательная функция для получения куки
//function getCookie(name) {
//    const value = `; ${document.cookie}`;
//    const parts = value.split(`; ${name}=`);
//    if (parts.length === 2) return parts.pop().split(';').shift();
//    return null;
//}
//
//// Пример функции для обновления календаря (нужно адаптировать под вашу логику)
//function updateCalendar() {
//    // Здесь код для обновления UI календаря после добавления события
//    console.log("Календарь обновлен");
//}