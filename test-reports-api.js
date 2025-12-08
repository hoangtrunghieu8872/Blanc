/**
 * Test script cho Reports API
 * Chạy: node test-reports-api.js
 * 
 * Yêu cầu: Server phải đang chạy trên localhost:4000
 */

const API_URL = 'http://localhost:4000/api';

// Bạn cần thay thế bằng token thật từ localStorage sau khi đăng nhập
// Hoặc sử dụng test token nếu có
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

async function testAPI() {
    console.log('🧪 Testing Reports API...\n');

    // Test 1: Health check
    console.log('1️⃣ Testing Health Endpoint...');
    try {
        const healthRes = await fetch(`${API_URL}/health`);
        const health = await healthRes.json();
        console.log('   ✅ Health:', health.status);
    } catch (err) {
        console.log('   ❌ Health check failed:', err.message);
        return;
    }

    // Test 2: Get reports (requires auth)
    console.log('\n2️⃣ Testing GET /reports...');
    if (!AUTH_TOKEN) {
        console.log('   ⚠️ Skipped - No AUTH_TOKEN provided');
        console.log('   💡 Để test đầy đủ, hãy:');
        console.log('      1. Đăng nhập vào app');
        console.log('      2. Mở DevTools > Application > Local Storage');
        console.log('      3. Copy giá trị auth_token');
        console.log('      4. Chạy: $env:AUTH_TOKEN="your-token"; node test-reports-api.js');
    } else {
        try {
            const reportsRes = await fetch(`${API_URL}/reports`, {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            if (reportsRes.ok) {
                const data = await reportsRes.json();
                console.log('   ✅ Got', data.reports?.length || 0, 'reports');
                console.log('   📊 Total:', data.total);
            } else {
                const error = await reportsRes.json();
                console.log('   ❌ Error:', error.error || reportsRes.statusText);
            }
        } catch (err) {
            console.log('   ❌ Request failed:', err.message);
        }
    }

    // Test 3: Get templates (public endpoint)
    console.log('\n3️⃣ Testing GET /reports/templates/list...');
    try {
        const templatesRes = await fetch(`${API_URL}/reports/templates/list`);
        if (templatesRes.ok) {
            const templates = await templatesRes.json();
            console.log('   ✅ Got', templates.length, 'templates');
            templates.forEach(t => console.log('      -', t.title));
        } else {
            console.log('   ℹ️ Templates endpoint returned:', templatesRes.status);
        }
    } catch (err) {
        console.log('   ℹ️ Templates endpoint may require auth');
    }

    console.log('\n✨ Test hoàn tất!');
    console.log('\n📝 Để test tạo/sửa/xóa báo cáo:');
    console.log('   1. Mở app tại http://localhost:3000');
    console.log('   2. Đăng nhập');
    console.log('   3. Vào phần "Báo cáo"');
    console.log('   4. Thử tạo báo cáo mới từ template');
    console.log('   5. Kiểm tra DevTools > Network để xem API calls');
}

testAPI();
