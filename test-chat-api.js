// Test script for Chat API
// Run with: node test-chat-api.js

const API_BASE = 'http://localhost:4000';

async function testAPI() {
    console.log('🔍 Testing Blanc Chat API...\n');

    // Test 1: Health Check
    console.log('1️⃣ Testing Health Endpoint...');
    try {
        const healthRes = await fetch(`${API_BASE}/api/health`);
        const health = await healthRes.json();
        console.log('   ✅ Health:', JSON.stringify(health, null, 2));
    } catch (err) {
        console.log('   ❌ Health check failed:', err.message);
    }

    // Test 2: Chat without auth (should fail)
    console.log('\n2️⃣ Testing Chat without auth (should return 401)...');
    try {
        const chatRes = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Xin chào' })
        });
        console.log('   Status:', chatRes.status);
        if (chatRes.status === 401) {
            console.log('   ✅ Correctly requires authentication');
        } else {
            const data = await chatRes.json();
            console.log('   Response:', data);
        }
    } catch (err) {
        console.log('   ❌ Error:', err.message);
    }

    // Test 3: Login to get token
    console.log('\n3️⃣ Testing Login...');
    let token = null;
    try {
        // Try with a test account - adjust credentials as needed
        const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'password123'
            })
        });

        if (loginRes.ok) {
            const loginData = await loginRes.json();
            token = loginData.token;
            console.log('   ✅ Login successful, got token');
        } else {
            const err = await loginRes.json();
            console.log('   ⚠️ Login failed (test user may not exist):', err.error);
        }
    } catch (err) {
        console.log('   ❌ Login error:', err.message);
    }

    // Test 4: Chat with auth
    if (token) {
        console.log('\n4️⃣ Testing Chat with auth...');
        try {
            const chatRes = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: 'Tôi muốn tìm đồng đội cho cuộc thi lập trình'
                })
            });

            if (chatRes.ok) {
                const chatData = await chatRes.json();
                console.log('   ✅ Chat response received!');
                console.log('   Intent:', chatData.intent);
                console.log('   Response preview:', chatData.response?.substring(0, 200) + '...');
                console.log('   Suggestions:', chatData.suggestions);
            } else {
                const err = await chatRes.json();
                console.log('   ❌ Chat failed:', err.error);
            }
        } catch (err) {
            console.log('   ❌ Chat error:', err.message);
        }
    }

    console.log('\n✨ Test complete!');
}

testAPI().catch(console.error);
