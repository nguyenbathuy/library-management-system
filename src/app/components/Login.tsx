import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { client } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';

import { toast } from 'sonner';

interface LoginProps {
  onLogin?: (token: string, user: any) => void; // Optional now
  onRegister?: (name: string, email: string, password: string) => void;
}

export function Login({ }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegistering) {
        await client.post('/auth/register', { email, password, name });
        toast.success('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
        setIsRegistering(false);
      } else {
        const { data } = await client.post('/auth/login', { email, password });
        login(data.token, data.user);
        toast.success(`Chào mừng ${data.user.name || 'bạn'} đã đăng nhập thành công!`);
        navigate('/');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row">

        {/* Left Side - Branding */}
        <div className="w-full md:w-1/2 bg-blue-600 p-12 flex flex-col justify-center items-center text-white">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-3">LibraryPKA</h1>
            <p className="text-blue-100 mb-8 text-sm">Hệ thống quản lý thư viện số</p>

            {/* Logo Container */}
            <div className="bg-white rounded-3xl p-8 shadow-lg mb-6">
              <div className="bg-gray-100 rounded-2xl p-8">
                <img
                  src="/images/phenikaa-logo.png"
                  alt="Phenikaa University"
                  className="w-56 h-auto mx-auto object-contain"
                />
              </div>
            </div>

            <p className="text-blue-100 italic text-sm">
              "Tri thức là sức mạnh."
            </p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Đăng nhập hệ thống
            </h2>
            <p className="text-gray-500 text-sm">
              Vui lòng nhập thông tin các trúc
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Họ và tên
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    placeholder="Nhập họ và tên"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="user@library.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3.5 rounded-lg transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            >
              <ArrowRight size={20} />
              {loading ? 'Đang xử lý...' : (isRegistering ? 'Đăng ký' : 'Đăng nhập')}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-600 text-sm">
              {isRegistering ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
              <button
                onClick={() => setIsRegistering(!isRegistering)}
                className="ml-2 text-blue-600 hover:text-blue-700 font-semibold hover:underline focus:outline-none transition-colors"
              >
                {isRegistering ? 'Đăng nhập ngay' : 'Đăng ký ngay'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}