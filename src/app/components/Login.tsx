import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { client } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, KeyRound, X, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface LoginProps {
  onLogin?: (token: string, user: any) => void;
  onRegister?: (name: string, email: string, password: string) => void;
}

export function Login({ }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  // States cho tính năng Quên mật khẩu (Forgot Password Modal)
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [resetting, setResetting] = useState(false);

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

  // Bước 1: Gửi mã OTP về email
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('Vui lòng nhập địa chỉ email của bạn');
      return;
    }

    setOtpSending(true);
    const toastId = toast.loading('Đang tạo và gửi mã OTP qua email...');
    try {
      const { data } = await client.post('/auth/forgot-password', { email: forgotEmail.trim() });
      toast.success(data.message || 'Mã xác thực OTP đã được gửi đến email!', { id: toastId });
      setForgotStep(2);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Không thể gửi mã OTP. Vui lòng kiểm tra lại email!', { id: toastId });
    } finally {
      setOtpSending(false);
    }
  };

  // Bước 2: Xác nhận OTP và đặt lại mật khẩu mới
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      toast.error('Vui lòng nhập mã OTP 6 chữ số');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có tối thiểu 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại');
      return;
    }

    setResetting(true);
    const toastId = toast.loading('Đang xử lý đổi mật khẩu...');
    try {
      const { data } = await client.post('/auth/reset-password', {
        email: forgotEmail.trim(),
        otp: otp.trim(),
        newPassword
      });
      toast.success(data.message || 'Đổi mật khẩu thành công! Bạn có thể đăng nhập ngay.', { id: toastId });
      
      // Đóng modal và reset form
      setShowForgotModal(false);
      setForgotStep(1);
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      // Điền sẵn email vừa đổi vào form đăng nhập để tiện thao tác
      setEmail(forgotEmail);
      setPassword('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại!', { id: toastId });
    } finally {
      setResetting(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
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
              {isRegistering ? 'Đăng ký tài khoản' : 'Đăng nhập hệ thống'}
            </h2>
            <p className="text-gray-500 text-sm">
              {isRegistering ? 'Tạo tài khoản độc giả mới tại Thư Viện PKA' : 'Vui lòng nhập thông tin để truy cập hệ thống'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Mật khẩu
                </label>
                {!isRegistering && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgotModal(true);
                      setForgotStep(1);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium focus:outline-none transition-colors"
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
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

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3.5 rounded-lg transition-all transform hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              >
                <ArrowRight size={20} />
                {loading ? 'Đang xử lý...' : (isRegistering ? 'Đăng ký tài khoản' : 'Đăng nhập')}
              </button>
            </div>
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

      {/* MODAL QUÊN MẬT KHẨU / FORGOT PASSWORD */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 transition-all transform animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                  {forgotStep === 1 ? <KeyRound size={20} /> : <ShieldCheck size={20} />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {forgotStep === 1 ? 'Quên mật khẩu' : 'Xác thực OTP & Đổi mật khẩu'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {forgotStep === 1 ? 'Bước 1/2: Nhập email tài khoản' : 'Bước 2/2: Nhập OTP và mật khẩu mới'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeForgotModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {forgotStep === 1 ? (
                /* BƯỚC 1: NHẬP EMAIL */
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="text-sm text-gray-600 leading-relaxed">
                    Vui lòng nhập địa chỉ email đã đăng ký. Hệ thống sẽ gửi một mã xác thực <strong>OTP gồm 6 chữ số</strong> đến hòm thư của bạn.
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Địa chỉ Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="vidu: user@domain.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeForgotModal}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={otpSending}
                      className="px-5 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {otpSending && <Loader2 size={16} className="animate-spin" />}
                      {otpSending ? 'Đang gửi mã...' : 'Gửi mã OTP'}
                    </button>
                  </div>
                </form>
              ) : (
                /* BƯỚC 2: NHẬP OTP VÀ MẬT KHẨU MỚI */
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
                    Mã OTP 6 chữ số đã được gửi tới email <strong className="font-semibold text-blue-900">{forgotEmail}</strong>. Mã này có hiệu lực trong 15 phút.
                  </div>

                  {/* Ô nhập OTP */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Mã xác thực OTP (6 chữ số)
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="Ví dụ: 123456"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm tracking-widest font-mono font-semibold transition-all"
                        required
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-end mt-1">
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={otpSending}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {otpSending ? 'Đang gửi lại...' : 'Chưa nhận được mã? Gửi lại'}
                      </button>
                    </div>
                  </div>

                  {/* Mật khẩu mới */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Mật khẩu mới
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Tối thiểu 6 ký tự"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Xác nhận mật khẩu mới */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Xác nhận mật khẩu mới
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu mới"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-between border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors font-medium flex items-center gap-1.5"
                    >
                      <ArrowLeft size={16} /> Quay lại
                    </button>
                    <button
                      type="submit"
                      disabled={resetting}
                      className="px-5 py-2.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {resetting && <Loader2 size={16} className="animate-spin" />}
                      {resetting ? 'Đang đổi mật khẩu...' : 'Xác nhận đổi mật khẩu'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}