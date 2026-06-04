async function test() {
  try {
    const res = await fetch('http://localhost:4000/api/debug-env');
    const data = await res.json();
    console.log('Server Env Check:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

test();
