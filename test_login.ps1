# Test Login API
$loginUrl = "http://localhost:5000/api/auth/login"
$body = @{
    email = "admin@gmail.com"
    password = "123"
} | ConvertTo-Json

Write-Host "Testing Login API at $loginUrl" -ForegroundColor Cyan
Write-Host "Credentials: admin@gmail.com / 123" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $body -ContentType "application/json"
    Write-Host "`nLogin successful!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "`nLogin failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Red
    }
}
