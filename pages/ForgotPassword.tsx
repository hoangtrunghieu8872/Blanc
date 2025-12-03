import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Card } from '../components/ui/Common';
import OtpInput from '../components/OtpInput';
import { api } from '../lib/api';
import { ArrowLeft, Mail, CheckCircle, Lock, KeyRound } from 'lucide-react';

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
            // Generate new session token
            const newSessionToken = generateSessionToken();
            setSessionToken(newSessionToken);

            const response = await api.post<OtpResponse>('/otp/request', {
                email,
                sessionToken: newSessionToken,
                action: 'reset_password',
            });

            setOtpData({
                ttlSeconds: response.ttlSeconds,
                expiresAt: response.expiresAt,
            });
            setStep('otp');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
            const vietnameseErrors: Record<string, string> = {
                'Email và session token là bắt buộc.': 'Vui lòng nhập địa chỉ email.',
                'Email không hợp lệ.': 'Địa chỉ email không hợp lệ.',
                'Email này chưa được đăng ký trong hệ thống.': 'Email này chưa được đăng ký trong hệ thống.',
                'RATE_LIMITED': 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.',
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
        });

        const newToken = response.sessionToken || generateSessionToken();
        setSessionToken(newToken);

        return {
            sessionToken: newToken,
            ttlSeconds: response.ttlSeconds,
            expiresAt: response.expiresAt,
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
            });

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
        <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <Card className="max-w-md w-full p-8 md:p-12 shadow-xl border-0">

                {/* Step 1: Enter Email */}
                {step === 'email' && (
                    <>
                        <button
                            onClick={() => navigate('/login')}
                            className="flex items-center text-slate-500 hover:text-slate-700 mb-6 text-sm"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Quay lại đăng nhập
                        </button>

                        <div className="mb-8">
                            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                                <Mail className="w-6 h-6 text-primary-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">
                                Quên mật khẩu?
                            </h2>
                            <p className="text-slate-500 text-sm">
                                Nhập email đã đăng ký để nhận mã xác thực OTP.
                            </p>
                        </div>

                        <form className="space-y-5" onSubmit={handleRequestOtp}>
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <Input
                                label="Email"
                                type="email"
                                name="email"
                                placeholder="example@email.com"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setError(null);
                                }}
                                required
                            />

                            <Button type="submit" className="w-full h-12" disabled={isLoading}>
                                {isLoading ? 'Đang gửi...' : 'Gửi mã OTP'}
                            </Button>
                        </form>

                        <div className="mt-6 text-center text-sm text-slate-500">
                            Nhớ mật khẩu rồi?{' '}
                            <span
                                onClick={() => navigate('/login')}
                                className="text-primary-600 hover:text-primary-700 font-bold cursor-pointer"
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
                    />
                )}

                {/* Step 3: Set New Password */}
                {step === 'newPassword' && (
                    <>
                        <div className="mb-8 text-center">
                            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                                <Lock className="w-6 h-6 text-primary-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">
                                Đặt mật khẩu mới
                            </h2>
                            <p className="text-slate-500 text-sm">
                                Tạo mật khẩu mới cho tài khoản của bạn.
                            </p>
                        </div>

                        <form className="space-y-5" onSubmit={handleSetPassword}>
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <Input
                                label="Mật khẩu mới"
                                type="password"
                                name="newPassword"
                                placeholder="Ít nhất 6 ký tự"
                                value={newPassword}
                                onChange={(e) => {
                                    setNewPassword(e.target.value);
                                    setError(null);
                                }}
                                autoComplete="new-password"
                                required
                            />

                            <Input
                                label="Xác nhận mật khẩu"
                                type="password"
                                name="confirmPassword"
                                placeholder="Nhập lại mật khẩu"
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    setError(null);
                                }}
                                autoComplete="new-password"
                                required
                            />

                            <Button type="submit" className="w-full h-12" disabled={isLoading}>
                                {isLoading ? 'Đang xử lý...' : 'Đặt mật khẩu mới'}
                            </Button>
                        </form>
                    </>
                )}

                {/* Step 4: Success */}
                {step === 'success' && (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">
                            Đặt lại mật khẩu thành công!
                        </h2>
                        <p className="text-slate-500 text-sm mb-6">
                            Mật khẩu của bạn đã được cập nhật. Bạn có thể đăng nhập với mật khẩu mới.
                        </p>
                        <Button
                            className="w-full"
                            onClick={() => navigate('/login')}
                        >
                            <KeyRound className="w-4 h-4 mr-2" />
                            Đăng nhập ngay
                        </Button>
                    </div>
                )}

            </Card>
        </div>
    );
};

export default ForgotPassword;
