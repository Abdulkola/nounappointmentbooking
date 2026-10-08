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
				// Authenticate with the server so protected pages receive a session cookie.
				var res = await fetch('/api/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ username: username, password: password })
				});

				console.log('POST /api/login sent', { username });

				if (res.ok) {
					sessionStorage.setItem('loggedInUser', username);
					window.location.href = username === 'admin' ? '/admin-dashboard.html' : '/student-dashboard.html';
					return;
				}

				var data = await res.json().catch(() => ({}));
				if (errorEl) {
					errorEl.textContent = data.error || 'Invalid username or password.';
					errorEl.classList.remove('d-none');
				}
			} catch (err) {
				if (errorEl) {
					// Keep the frontend fallback available for static-only hosting.
					if (username === 'admin' && password === 'admin123') {
						sessionStorage.setItem('loggedInUser', username);
						window.location.href = '/admin-dashboard.html';
						return;
					}
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
			// Clear local sessionStorage and attempt backend logout if available
			sessionStorage.removeItem('loggedInUser');
			try {
				await fetch('/api/logout', { method: 'POST', credentials: 'include' });
			} catch (e) {}
			window.location.href = '/index.html';
		});
	}
});
