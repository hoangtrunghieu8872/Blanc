/**
 * Forgot Password Page
 * Multi-step password reset flow:
 * 1. Enter email to request OTP
 * 2. Verify OTP
 * 3. Set new password
 * 4. Success confirmation
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle, Lock, KeyRound, AlertCircle } from 'lucide-react';
import api from '../services/api';
import OtpInput from './OtpInput';

// Generate session token (UUID-like)
function generateSessionToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

type Step = 'email' | 'otp' | 'newPassword' | 'success';

interface OtpResponse {
    ok: boolean;
    message: string;
    ttlSeconds: number;
    expiresAt: string;
    sessionToken?: string;
}

const ForgotPassword: React.FC = () => {
    const navigate = useNavigate();

    // Form state
    const [email, setEmail] = useState('');
    const [sessionToken, setSessionToken] = useState('');
    const [verificationToken, setVerificationToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // UI state
    const [step, setStep] = useState<Step>('email');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [otpData, setOtpData] = useState<{ ttlSeconds: number; expiresAt: string } | null>(null);

    // Step 1: Request OTP
    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const newSessionToken = generateSessionToken();
            setSessionToken(newSessionToken);

            const response = await api.post<OtpResponse>('/otp/request', {
                email,
                sessionToken: newSessionToken,
                action: 'reset_password',
            }, { skipAuth: true });

            setOtpData({
                ttlSeconds: response.data.ttlSeconds,
                expiresAt: response.data.expiresAt,
            });
            setStep('otp');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
            const vietnameseErrors: Record<string, string> = {
                'Email và session token là bắt buộc.': 'Vui lòng nhập địa chỉ email.',
                'Email không hợp lệ.': 'Địa chỉ email không hợp lệ.',
                'Email này chưa được đăng ký trong hệ thống.': 'Email này chưa được đăng ký trong hệ thống.',
                'RATE_LIMITED': 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.',
                'User not found': 'Email không tồn tại trong hệ thống.',
            };
            setError(vietnameseErrors[errorMessage] || errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle OTP verification success
    const handleOtpSuccess = (token: string) => {
        setVerificationToken(token);
        setStep('newPassword');
    };

    // Handle resend OTP
    const handleResendOtp = async (): Promise<{ sessionToken: string; ttlSeconds: number; expiresAt: string }> => {
        const response = await api.post<OtpResponse>('/otp/resend', {
            email,
            action: 'reset_password',
        }, { skipAuth: true });

        const newToken = response.data.sessionToken || generateSessionToken();
        setSessionToken(newToken);

        return {
            sessionToken: newToken,
            ttlSeconds: response.data.ttlSeconds,
            expiresAt: response.data.expiresAt,
        };
    };

    // Step 3: Set new password
    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await api.post('/auth/reset-password', {
                token: verificationToken,
                password: newPassword,
            }, { skipAuth: true });

            setStep('success');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
            const vietnameseErrors: Record<string, string> = {
                'Token and new password are required.': 'Thiếu thông tin xác thực.',
                'Password must be at least 6 characters.': 'Mật khẩu phải có ít nhất 6 ký tự.',
                'Invalid or expired reset token.': 'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thử lại.',
            };
            setError(vietnameseErrors[errorMessage] || errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-emerald-900 to-gray-900 p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative">
                {/* Card */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8">

                    {/* Step 1: Enter Email */}
                    {step === 'email' && (
                        <>
                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="flex items-center text-emerald-100/50 hover:text-emerald-100/70 mb-6 text-sm transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                Quay lại đăng nhập
                            </button>

                            <div className="mb-8 text-center">
                                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                                    <Mail className="w-8 h-8 text-emerald-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">
                                    Quên mật khẩu?
                                </h2>
                                <p className="text-emerald-100/70 text-sm">
                                    Nhập email đã đăng ký để nhận mã xác thực OTP.
                                </p>
                            </div>

                            <form className="space-y-5" onSubmit={handleRequestOtp}>
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-red-200 text-sm">{error}</p>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-emerald-100 mb-2">
                                        Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                setError(null);
                                            }}
                                            placeholder="admin@blanc.edu.vn"
                                            required
                                            className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || !email}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Đang gửi...
                                        </>
                                    ) : (
                                        'Gửi mã OTP'
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 text-center text-sm text-emerald-100/50">
                                Nhớ mật khẩu rồi?{' '}
                                <span
                                    onClick={() => navigate('/login')}
                                    className="text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer transition-colors"
                                >
                                    Đăng nhập
                                </span>
                            </div>
                        </>
                    )}

                    {/* Step 2: Enter OTP */}
                    {step === 'otp' && otpData && (
                        <OtpInput
                            email={email}
                            sessionToken={sessionToken}
                            ttlSeconds={otpData.ttlSeconds}
                            expiresAt={otpData.expiresAt}
                            onVerifySuccess={handleOtpSuccess}
                            onResendOtp={handleResendOtp}
                            onCancel={() => {
                                setStep('email');
                                setError(null);
                            }}
                            title="Xác thực email"
                            subtitle={`Nhập mã OTP đã gửi đến ${email}`}
                        />
                    )}

                    {/* Step 3: Set New Password */}
                    {step === 'newPassword' && (
                        <>
                            <div className="mb-8 text-center">
                                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                                    <Lock className="w-8 h-8 text-emerald-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">
                                    Đặt mật khẩu mới
                                </h2>
                                <p className="text-emerald-100/70 text-sm">
                                    Tạo mật khẩu mới cho tài khoản của bạn.
                                </p>
                            </div>

                            <form className="space-y-5" onSubmit={handleSetPassword}>
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-red-200 text-sm">{error}</p>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="newPassword" className="block text-sm font-medium text-emerald-100 mb-2">
                                        Mật khẩu mới
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            id="newPassword"
                                            type={showPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => {
                                                setNewPassword(e.target.value);
                                                setError(null);
                                            }}
                                            placeholder="Ít nhất 6 ký tự"
                                            required
                                            minLength={6}
                                            className="w-full pl-11 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                        >
                                            {showPassword ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-emerald-100 mb-2">
                                        Xác nhận mật khẩu
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => {
                                                setConfirmPassword(e.target.value);
                                                setError(null);
                                            }}
                                            placeholder="Nhập lại mật khẩu"
                                            required
                                            className="w-full pl-11 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                        >
                                            {showConfirmPassword ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Đang xử lý...
                                        </>
                                    ) : (
                                        'Đặt mật khẩu mới'
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    {/* Step 4: Success */}
                    {step === 'success' && (
                        <div className="text-center py-6">
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="w-10 h-10 text-green-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">
                                Đặt lại mật khẩu thành công!
                            </h2>
                            <p className="text-emerald-100/70 text-sm mb-6">
                                Mật khẩu của bạn đã được cập nhật. Bạn có thể đăng nhập với mật khẩu mới.
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/30 transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                <KeyRound className="w-5 h-5" />
                                Đăng nhập ngay
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-emerald-200/50 text-sm mt-6">
                    © 2024 Blanc. All rights reserved.
                </p>
            </div>
        </div>
    );
};

export default ForgotPassword;
