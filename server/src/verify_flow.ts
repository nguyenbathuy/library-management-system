import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const TIMESTAMP = Date.now();
const EMAIL = `test_user_${TIMESTAMP}@example.com`;
const PASSWORD = 'password123';
const NAME = `Test User ${TIMESTAMP}`;

async function runTest() {
    console.log('🚀 Starting System Verification...');
    console.log(`Target: ${API_URL}`);

    try {
        // 1. Register
        console.log(`\n1. Registering user: ${EMAIL}...`);
        await axios.post(`${API_URL}/auth/register`, {
            email: EMAIL,
            password: PASSWORD,
            name: NAME
        });
        console.log('✅ Registration successful');

        // 2. Login
        console.log('\n2. Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });
        const token = loginRes.data.token;
        if (!token) throw new Error('No token received');
        console.log('✅ Login successful. Token received.');

        const authHeader = { headers: { Authorization: `Bearer ${token}` } };

        // 3. Get Books
        console.log('\n3. Fetching books...');
        const booksRes = await axios.get(`${API_URL}/books`, authHeader);
        console.log(`✅ Books fetched. Count: ${booksRes.data.length}`);

        if (booksRes.data.length === 0) {
            console.log('⚠️ No books available to test borrowing.');
            return;
        }

        const bookToBorrow = booksRes.data.find((b: any) => b.available > 0);
        if (!bookToBorrow) {
            console.log('⚠️ All books are currently borrowed.');
            return;
        }

        // 4. Borrow Book
        console.log(`\n4. Borrowing book: "${bookToBorrow.title}" (ID: ${bookToBorrow.id})...`);
        await axios.post(`${API_URL}/loans/borrow`, { bookId: bookToBorrow.id }, authHeader);
        console.log('✅ Borrow successful');

        // 5. Check "My Loans"
        console.log('\n5. Checking "My Loans"...');
        const loansRes = await axios.get(`${API_URL}/loans/my`, authHeader);
        const myLoan = loansRes.data.find((l: any) => l.bookId === bookToBorrow.id);
        if (!myLoan) throw new Error('Borrowed book not found in my loans');
        console.log('✅ Loan verification successful');

        // 6. Login as Admin (to return book)
        console.log('\n6. Logging in as Admin (to return book)...');
        const adminLoginRes = await axios.post(`${API_URL}/auth/login`, {
            email: "admin@library.com",
            password: "123"
        });
        const adminToken = adminLoginRes.data.token;
        const adminAuthHeader = { headers: { Authorization: `Bearer ${adminToken}` } };
        console.log('✅ Admin login successful');

        // 7. Return Book
        console.log(`\n7. Returning book (Loan ID: ${myLoan.id})...`);
        await axios.post(`${API_URL}/loans/return`, { loanId: myLoan.id }, adminAuthHeader);
        console.log('✅ Return successful');

        console.log('\n✨ ALL SYSTEM TESTS PASSED SUCCESSFULLY! ✨');

    } catch (error: any) {
        console.error('\n❌ TEST FAILED');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

runTest();
