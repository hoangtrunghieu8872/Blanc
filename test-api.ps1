# Test script for Blanc API
# Usage: .\test-api.ps1

$baseUrl = "http://localhost:4000/api"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Blanc API Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n[1] Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "✓ Health Check: OK" -ForegroundColor Green
    Write-Host "  Status: $($health.status)"
    Write-Host "  MongoDB: $($health.mongodb)"
}
catch {
    Write-Host "✗ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Chat API (no auth - should fail with 401)
Write-Host "`n[2] Testing Chat API (without auth)..." -ForegroundColor Yellow
try {
    $chatBody = @{
        message = "Xin chào, tôi muốn tìm đồng đội"
    } | ConvertTo-Json -Depth 10
    
    $chat = Invoke-RestMethod -Uri "$baseUrl/chat" -Method POST -Body $chatBody -ContentType "application/json"
    Write-Host "✓ Chat Response received" -ForegroundColor Green
    Write-Host "  Response: $($chat.reply.Substring(0, [Math]::Min(100, $chat.reply.Length)))..."
}
catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✓ Chat API correctly requires authentication (401)" -ForegroundColor Green
    }
    else {
        Write-Host "✗ Chat API Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 3: Matching API (no auth - should fail with 401)
Write-Host "`n[3] Testing Matching API (without auth)..." -ForegroundColor Yellow
try {
    $matching = Invoke-RestMethod -Uri "$baseUrl/matching/recommendations" -Method GET
    Write-Host "✓ Matching Response received" -ForegroundColor Green
}
catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✓ Matching API correctly requires authentication (401)" -ForegroundColor Green
    }
    else {
        Write-Host "✗ Matching API Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 4: Login to get token
Write-Host "`n[4] Testing Login API..." -ForegroundColor Yellow
$token = $null
try {
    # You need to replace with actual test credentials
    $loginBody = @{
        email    = "test@example.com"
        password = "testpassword123"
    } | ConvertTo-Json
    
    $login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $login.token
    Write-Host "✓ Login successful, token received" -ForegroundColor Green
}
catch {
    Write-Host "⚠ Login failed (expected if test user doesn't exist): $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "  Skipping authenticated tests..." -ForegroundColor Yellow
}

# If we have a token, test authenticated endpoints
if ($token) {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    # Test 5: Chat API with auth
    Write-Host "`n[5] Testing Chat API (with auth)..." -ForegroundColor Yellow
    try {
        $chatBody = @{
            message = "Tôi muốn tìm đồng đội cho cuộc thi lập trình"
        } | ConvertTo-Json -Depth 10
        
        $chat = Invoke-RestMethod -Uri "$baseUrl/chat" -Method POST -Body $chatBody -ContentType "application/json" -Headers $headers
        Write-Host "✓ Chat Response:" -ForegroundColor Green
        Write-Host "  $($chat.reply.Substring(0, [Math]::Min(200, $chat.reply.Length)))..."
    }
    catch {
        Write-Host "✗ Chat Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 6: Matching API with auth
    Write-Host "`n[6] Testing Matching API (with auth)..." -ForegroundColor Yellow
    try {
        $matching = Invoke-RestMethod -Uri "$baseUrl/matching/recommendations" -Method GET -Headers $headers
        Write-Host "✓ Matching Response:" -ForegroundColor Green
        Write-Host "  Total Recommendations: $($matching.recommendations.Count)"
        Write-Host "  Cache Hit: $($matching.cached)"
        foreach ($rec in $matching.recommendations) {
            Write-Host "  - $($rec.user.name): Score $($rec.matchScore)%" -ForegroundColor Cyan
        }
    }
    catch {
        Write-Host "✗ Matching Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Test Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
