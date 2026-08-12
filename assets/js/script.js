document.addEventListener('DOMContentLoaded', function () {
	var form = document.getElementById('loginForm');
	var errorEl = document.getElementById('loginError');

	if (form) {
		form.addEventListener('submit', async function (e) {
			e.preventDefault();
			console.log('loginForm submit fired');
			if (errorEl) errorEl.classList.add('d-none');

			var username = (document.getElementById('username') || {}).value || '';
			var password = (document.getElementById('password') || {}).value || '';

			try {
				var res = await fetch('/api/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ username: username, password: password })
				});

				console.log('POST /api/login sent', { username });

				if (res.ok) {
					window.location.href = '/student-dashboard.html';
					return;
				}

				var data = await res.json().catch(() => ({}));
				if (errorEl) {
					errorEl.textContent = data.error || 'Invalid username or password.';
					errorEl.classList.remove('d-none');
				}
			} catch (err) {
				if (errorEl) {
					errorEl.textContent = 'Network error. Please try again.';
					errorEl.classList.remove('d-none');
				}
			}
		});
	}

	// Logout handler (if present)
	var logoutLink = document.getElementById('logoutLink');
	if (logoutLink) {
		logoutLink.addEventListener('click', async function (e) {
			e.preventDefault();
			console.log('logout clicked');
			try {
				await fetch('/api/logout', { method: 'POST' });
			} catch (e) {}
			window.location.href = '/index.html';
		});
	}
});
