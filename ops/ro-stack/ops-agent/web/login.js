const form = document.getElementById('loginForm');
const button = document.getElementById('loginButton');
const status = document.getElementById('loginStatus');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  button.disabled = true;
  status.textContent = '正在驗證身分…';
  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    });
    if (response.ok) {
      location.replace('/');
      return;
    }
    status.textContent =
      response.status === 429
        ? '嘗試次數過多，請十分鐘後再試。'
        : '帳號或密碼錯誤。';
  } catch {
    status.textContent = '目前無法連線至管理服務。';
  } finally {
    button.disabled = false;
  }
});
