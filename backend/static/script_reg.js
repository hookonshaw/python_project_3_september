//document.getElementById('loginForm').addEventListener('submit', async (e) => {
//    e.preventDefault();
//    const username = document.getElementById('username').value;
//    const password = document.getElementById('password').value;
//    const messageDiv = document.getElementById('message');
//
//    try {
//        const response = await fetch('/login', {
//            method: 'POST',
//            headers: { 'Content-Type': 'application/json' },
//            body: JSON.stringify({ username, password }),
//            credentials: 'include'
//        });
//
//        if (response.redirected) {
//            window.location.href = response.url; // Редирект на /admin
//        } else if (response.status === 401) {
//            messageDiv.textContent = 'Неверный логин или пароль';
//        } else {
//            messageDiv.textContent = 'Неизвестная ошибка';
//        }
//    } catch (error) {
//        messageDiv.textContent = 'Ошибка при отправке данных';
//        console.error('Ошибка:', error);
//    }
//});

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
            credentials: 'include' // Для передачи cookies
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                window.location.href = '/admin'; // Явное перенаправление
            } else {
                messageDiv.textContent = 'Неизвестная ошибка';
            }
        } else if (response.status === 401) {
            messageDiv.textContent = 'Неверный логин или пароль';
        } else {
            messageDiv.textContent = 'Неизвестная ошибка';
        }
    } catch (error) {
        messageDiv.textContent = 'Ошибка при отправке данных';
        console.error('Ошибка:', error);
    }
});


// Анимация пузырьков
document.addEventListener("DOMContentLoaded", function() {
    const bubblesContainer = document.querySelector('.floating-bubbles');
    
    for (let i = 0; i < 15; i++) {
        createBubble();
    }
    
    function createBubble() {
        const bubble = document.createElement('div');
        bubble.classList.add('bubble');
        
        // Случайные параметры для пузырька
        const size = Math.random() * 100 + 50;
        const posX = Math.random() * window.innerWidth;
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * 5;
        
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${posX}px`;
        bubble.style.animationDuration = `${duration}s`;
        bubble.style.animationDelay = `${delay}s`;
        
        bubblesContainer.appendChild(bubble);
        
        // После завершения анимации удаляем пузырек и создаем новый
        bubble.addEventListener('animationend', function() {
            bubble.remove();
            createBubble();
        });
    }
    
    // Переключение видимости пароля
    document.getElementById("togglePassword").addEventListener("click", function() {
        let passwordInput = document.getElementById("password");
        let toggleIcon = document.getElementById("togglePassword");
        
        let closedEye = "hide.png";
        let openEye = "view.png";
        
        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            toggleIcon.src = openEye + "?t=" + new Date().getTime();
        } else {
            passwordInput.type = "password";
            toggleIcon.src = closedEye + "?t=" + new Date().getTime();
        }
    });
});