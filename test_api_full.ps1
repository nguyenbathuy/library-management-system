# Test Login API với credential đúng
$loginUrl = "http://localhost:5000/api/auth/login"

# Test với admin@library.com (từ seed data)
$body = @{
    email = "admin@library.com"
    password = "123"
} | ConvertTo-Json

Write-Host "`n=== Testing Login with admin@library.com ===" -ForegroundColor Cyan
Write-Host "Credentials: admin@library.com / 123" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $body -ContentType "application/json"
    Write-Host "`nLogin successful!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
    
    # Lưu token để test các API khác
    $token = $response.token
    Write-Host "`nToken saved: $token" -ForegroundColor Green
    
    # Test get books
    Write-Host "`n=== Testing Get Books API ===" -ForegroundColor Cyan
    $booksUrl = "http://localhost:5000/api/books"
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $books = Invoke-RestMethod -Uri $booksUrl -Method GET -Headers $headers
    Write-Host "Total books: $($books.Count)" -ForegroundColor Green
    Write-Host "First 3 books:" -ForegroundColor Yellow
    $books[0..2] | ForEach-Object { Write-Host "  - $($_.title) by $($_.author)" -ForegroundColor White }
    
} catch {
    Write-Host "`nLogin failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test với user@library.com
Write-Host "`n`n=== Testing Login with user@library.com ===" -ForegroundColor Cyan
$userBody = @{
    email = "user@library.com"
    password = "123"
} | ConvertTo-Json

try {
    $userResponse = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $userBody -ContentType "application/json"
    Write-Host "`nUser login successful!" -ForegroundColor Green
    Write-Host "User info:" -ForegroundColor Yellow
    $userResponse | ConvertTo-Json -Depth 10
} catch {
    Write-Host "`nUser login failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
