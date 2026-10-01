import { ReactNode } from 'react';
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

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/profile" replace />;
  return <>{children}</>;
};

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />

          <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}>
            <Route path="/" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/books" element={<BooksManagement />} />
            <Route path="/members" element={<AdminRoute><MembersManagement /></AdminRoute>} />
            <Route path="/borrowed" element={<BorrowedBooks />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </LanguageProvider>
    </ThemeProvider>
  );
}