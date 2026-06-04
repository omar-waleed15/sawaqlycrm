async function test() {
  try {
    const res = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@sawaqly.com',
        password: 'Admin@1234'
      })
    });
    const data = await res.json();
    console.log('Status Code:', res.status);
    console.log('Response Body:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

test();
