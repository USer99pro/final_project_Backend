const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const port = process.env.PORT || 3500;
const baseUrl = (process.env.API_URL || `http://localhost:${port}`).replace(/\/$/, '');
const healthUrl = `${baseUrl}/health`;

async function testHealthEndpoint() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(healthUrl, { signal: controller.signal });
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      throw new Error(`Expected a JSON response, received: ${contentType || 'no Content-Type header'}`);
    }

    const body = await response.json();
    if (!response.ok || body.ok !== true) {
      throw new Error(`Unexpected health response (${response.status}): ${JSON.stringify(body)}`);
    }

    console.log(`✓ API health check passed: ${healthUrl}`);
  } finally {
    clearTimeout(timeout);
  }
}

testHealthEndpoint().catch((error) => {
  const hint = error.name === 'AbortError'
    ? 'The request timed out. Start the API with "npm run dev" and try again.'
    : 'Ensure the API is running (npm run dev), then try again.';
  console.error(`✗ API test failed: ${error.message}\n${hint}`);
  process.exitCode = 1;
});
