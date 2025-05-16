document.getElementById("togglePassword").addEventListener("click", function() {
    let passwordInput = document.getElementById("password");
    let toggleIcon = document.getElementById("togglePassword");

    // URLs изображений
    let closedEye = "hide.png";
    let openEye = "view.png";

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleIcon.src = openEye + "?t=" + new Date().getTime();
        console.log("Меняем на открытый глаз:", toggleIcon.src);
    } else {
        passwordInput.type = "password";
        toggleIcon.src = closedEye + "?t=" + new Date().getTime();
        console.log("Меняем на закрытый глаз:", toggleIcon.src);
    }
});



