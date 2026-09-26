# Test CRUD Operations for Books
$baseUrl = "http://localhost:5000/api"
$loginUrl = "$baseUrl/auth/login"
$booksUrl = "$baseUrl/books"

Write-Host "=== BOOK CRUD TESTING ===" -ForegroundColor Cyan

# Login to get token
Write-Host "`n1. Login as Admin..." -ForegroundColor Yellow
$loginBody = @{
    email = "admin@library.com"
    password = "123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "   ✓ Login successful" -ForegroundColor Green
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
} catch {
    Write-Host "   ✗ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Test GET all books
Write-Host "`n2. GET all books..." -ForegroundColor Yellow
try {
    $books = Invoke-RestMethod -Uri $booksUrl -Method GET -Headers $headers
    Write-Host "   ✓ Got $($books.Count) books" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test GET single book
if ($books.Count -gt 0) {
    $bookId = $books[0].id
    Write-Host "`n3. GET book by ID ($bookId)..." -ForegroundColor Yellow
    try {
        $book = Invoke-RestMethod -Uri "$booksUrl/$bookId" -Method GET -Headers $headers
        Write-Host "   ✓ Got book: $($book.title)" -ForegroundColor Green
    } catch {
        Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test CREATE book
Write-Host "`n4. POST create new book..." -ForegroundColor Yellow
$newBook = @{
    title = "Test Book - Auto Generated"
    author = "Test Author"
    isbn = "978-000-000-000-0"
    category = "Test"
    status = "Available"
    copies = 5
    available = 5
    publishedYear = "2024"
    publisher = "Test Publisher"
    pageCount = 100
    language = "Tiếng Việt"
    description = "This is a test book created by automated testing script"
} | ConvertTo-Json

try {
    $createdBook = Invoke-RestMethod -Uri $booksUrl -Method POST -Body $newBook -Headers $headers
    Write-Host "   ✓ Created book with ID: $($createdBook.id)" -ForegroundColor Green
    $testBookId = $createdBook.id
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# Test UPDATE book
if ($testBookId) {
    Write-Host "`n5. PUT update book..." -ForegroundColor Yellow
    $updateBook = @{
        title = "Test Book - UPDATED"
        author = "Test Author Updated"
        isbn = "978-000-000-000-0"
        category = "Test Updated"
        status = "Available"
        copies = 10
        available = 8
        publishedYear = "2024"
        publisher = "Test Publisher Updated"
        pageCount = 150
        language = "Tiếng Việt"
        description = "This book has been updated"
    } | ConvertTo-Json
    
    try {
        $updatedBook = Invoke-RestMethod -Uri "$booksUrl/$testBookId" -Method PUT -Body $updateBook -Headers $headers
        Write-Host "   ✓ Updated book: $($updatedBook.title)" -ForegroundColor Green
    } catch {
        Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails) {
            Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
}

# Test DELETE book
if ($testBookId) {
    Write-Host "`n6. DELETE book..." -ForegroundColor Yellow
    try {
        $deleteResponse = Invoke-RestMethod -Uri "$booksUrl/$testBookId" -Method DELETE -Headers $headers
        Write-Host "   ✓ Deleted book successfully" -ForegroundColor Green
    } catch {
        Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails) {
            Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== TESTING COMPLETE ===" -ForegroundColor Cyan
