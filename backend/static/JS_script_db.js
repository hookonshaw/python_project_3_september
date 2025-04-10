document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    console.log('Отправляем:', { username, password }); // Для отладки в консоли браузера
    const messageDiv = document.getElementById('message');
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password }) // JSON
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('access_token', data.access_token); // Сохранение токена в localStorage
            window.location.href = 'index.html';             // Перенаправление на главную страницу
        } else {
            messageDiv.textContent = 'Неверный логин или пароль';
        }
    } catch (error) {
        messageDiv.textContent = 'Ошибка при входе';
    }
});
