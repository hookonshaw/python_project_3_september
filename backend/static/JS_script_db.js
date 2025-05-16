document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include' // Передаем куки
        });

        // Проверка редиректа
        if (response.redirected) {
            window.location.href = response.url;
        } else if (response.status === 200) { // Если сервер возвращает JSON
            const data = await response.json();
            localStorage.setItem('access_token', data.access_token);
            window.location.href = '/static/index_admin.html';
        } else if (response.status === 401) {
            messageDiv.textContent = 'Неверный логин или пароль';
        } else {
            messageDiv.textContent = 'Неизвестная ошибка';
        }
    } catch (error) {
        messageDiv.textContent = 'Ошибка при отправке данных';
    }
});

