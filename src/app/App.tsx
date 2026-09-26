import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { Layout } from './Layout';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { BooksManagement } from './components/BooksManagement';
import { MembersManagement } from './components/MembersManagement';
import { BorrowedBooks } from './components/BorrowedBooks';
import { Settings } from './components/Settings';
import { UserProfile } from './components/UserProfile';

// Placeholder components until we refactor them
const DashboardWrapper = () => {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/profile" />;
  return <Dashboard books={[]} borrowedBooks={[]} members={[]} />; // Props will be ignored by new implementation eventually or we fix them next
};

const ProfileWrapper = () => <UserProfile currentUser={null} borrowedBooks={[]} />;
const BooksWrapper = () => <BooksManagement userRole={null} books={[]} setBooks={() => { }} onBorrow={() => { }} />;
const BorrowedWrapper = () => <BorrowedBooks userRole={null} borrowedBooks={[]} onReturnBook={() => { }} />;

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />

          <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
            <Route path="/" element={<DashboardWrapper />} />
            <Route path="/profile" element={<ProfileWrapper />} />
            <Route path="/books" element={<BooksWrapper />} />
            <Route path="/members" element={<MembersManagement />} />
            <Route path="/borrowed" element={<BorrowedWrapper />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </LanguageProvider>
    </ThemeProvider>
  );
}