import { Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

export function Layout() {
    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
            <Sidebar />
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Header />
                <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
