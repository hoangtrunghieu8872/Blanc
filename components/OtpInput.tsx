import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/Common';
import { api } from '../lib/api';
import { ShieldCheck, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface OtpInputProps {
    email: string;
    sessionToken: string;
    ttlSeconds: number;
    expiresAt: string;
    onVerifySuccess: (verificationToken: string) => void;
    onResendOtp: () => Promise<{ sessionToken: string; ttlSeconds: number; expiresAt: string }>;
    onCancel: () => void;
}

const OtpInput: React.FC<OtpInputProps> = ({
    email,
    sessionToken: initialSessionToken,
    ttlSeconds: initialTtl,
    expiresAt: initialExpiresAt,
    onVerifySuccess,
    onResendOtp,
    onCancel,
}) => {
    const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
    const [sessionToken, setSessionToken] = useState(initialSessionToken);
    const [timeRemaining, setTimeRemaining] = useState(initialTtl);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [remainingAttempts, setRemainingAttempts] = useState(5);
    const [cooldownSeconds, setCooldownSeconds] = useState(0);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const cooldownRef = useRef<NodeJS.Timeout | null>(null);

    // Countdown timer
    useEffect(() => {
        if (timeRemaining <= 0) return;

        timerRef.current = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [sessionToken]); // Reset on new session

    // Cooldown timer for resend
    useEffect(() => {
        if (cooldownSeconds <= 0) return;

        cooldownRef.current = setInterval(() => {
            setCooldownSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(cooldownRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
        };
    }, [cooldownSeconds]);

    // Format time as mm:ss
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle input change
    const handleChange = (index: number, value: string) => {
        // Only allow digits
        if (value && !/^\d$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        setError(null);

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all filled
        if (value && index === 5 && newOtp.every(d => d !== '')) {
            handleVerify(newOtp.join(''));
        }
    };

    // Handle key down
    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'ArrowRight' && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Handle paste
    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pastedData.length === 6) {
            const newOtp = pastedData.split('');
            setOtp(newOtp);
            inputRefs.current[5]?.focus();
            handleVerify(pastedData);
        }
    };

    // Verify OTP
    const handleVerify = useCallback(async (otpCode?: string) => {
        const code = otpCode || otp.join('');
        if (code.length !== 6) {
            setError('Vui lòng nhập đủ 6 số.');
            return;
        }

        if (timeRemaining <= 0) {
            setError('Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.');
            return;
        }

        setIsVerifying(true);
        setError(null);

        try {
            const data = await api.post<{
                ok: boolean;
                verificationToken: string;
                error?: string;
                remainingAttempts?: number;
            }>('/otp/verify', {
                email,
                sessionToken,
                otp: code,
            });

            setSuccess(true);
            setTimeout(() => {
                onVerifySuccess(data.verificationToken);
            }, 1000);

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
            // Extract remaining attempts from error message if present
            const attemptsMatch = errorMsg.match(/Còn (\d+) lần thử/);
            if (attemptsMatch) {
                setRemainingAttempts(parseInt(attemptsMatch[1], 10));
            }
            setError(errorMsg);
            setOtp(Array(6).fill(''));
            inputRefs.current[0]?.focus();
        } finally {
            setIsVerifying(false);
        }
    }, [otp, email, sessionToken, timeRemaining, onVerifySuccess]);

    // Resend OTP
    const handleResend = async () => {
        if (cooldownSeconds > 0) return;

        setIsResending(true);
        setError(null);

        try {
            const result = await onResendOtp();
            setSessionToken(result.sessionToken);
            setTimeRemaining(result.ttlSeconds);
            setOtp(Array(6).fill(''));
            setRemainingAttempts(5);
            setCooldownSeconds(60); // 60s cooldown
            inputRefs.current[0]?.focus();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không thể gửi lại mã');
        } finally {
            setIsResending(false);
        }
    };

    const isExpired = timeRemaining <= 0;
    const isLowTime = timeRemaining <= 30 && timeRemaining > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${success ? 'bg-green-100' : 'bg-primary-100'
                    }`}>
                    {success ? (
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                        <ShieldCheck className="w-8 h-8 text-primary-600" />
                    )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {success ? 'Xác thực thành công!' : 'Nhập mã OTP'}
                </h3>
                <p className="text-slate-500 text-sm">
                    Mã xác thực 6 số đã được gửi đến<br />
                    <span className="font-medium text-slate-700">{email}</span>
                </p>
            </div>

            {/* Timer */}
            <div className={`flex items-center justify-center gap-2 text-sm font-medium ${isExpired ? 'text-red-500' : isLowTime ? 'text-red-500' : 'text-slate-600'
                }`}>
                <Clock className="w-4 h-4" />
                {isExpired ? (
                    <span>Mã đã hết hạn</span>
                ) : (
                    <>
                        <span>Mã hết hạn sau:</span>
                        <span className={`font-mono text-lg ${isLowTime ? 'text-red-500 animate-pulse' : ''}`}>
                            {formatTime(timeRemaining)}
                        </span>
                    </>
                )}
            </div>

            {/* OTP Input */}
            {!success && (
                <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={el => { inputRefs.current[index] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleChange(index, e.target.value)}
                            onKeyDown={e => handleKeyDown(index, e)}
                            disabled={isVerifying || success || isExpired}
                            aria-label={`Số thứ ${index + 1}`}
                            placeholder="•"
                            className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold rounded-xl border-2 transition-all duration-200 outline-none placeholder:text-slate-300
                ${digit ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-white'}
                ${error ? 'border-red-400 bg-red-50 shake' : ''}
                ${isExpired ? 'opacity-50 cursor-not-allowed' : ''}
                focus:border-primary-500 focus:ring-4 focus:ring-primary-100
              `}
                        />
                    ))}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="flex items-center justify-center gap-2 text-red-600 text-sm bg-red-50 py-3 px-4 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Remaining Attempts */}
            {remainingAttempts < 5 && !success && (
                <p className="text-center text-sm text-amber-600">
                    Còn {remainingAttempts} lần thử
                </p>
            )}

            {/* Actions */}
            {!success && (
                <div className="space-y-3">
                    <Button
                        onClick={() => handleVerify()}
                        disabled={otp.some(d => !d) || isVerifying || isExpired}
                        className="w-full h-12"
                    >
                        {isVerifying ? 'Đang xác thực...' : 'Xác nhận'}
                    </Button>

                    <div className="flex items-center justify-center gap-1 text-sm">
                        <span className="text-slate-500">Không nhận được mã?</span>
                        <button
                            onClick={handleResend}
                            disabled={isResending || cooldownSeconds > 0}
                            className={`font-medium flex items-center gap-1 ${cooldownSeconds > 0
                                    ? 'text-slate-400 cursor-not-allowed'
                                    : 'text-primary-600 hover:text-primary-700'
                                }`}
                        >
                            <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                            {cooldownSeconds > 0 ? `Gửi lại (${cooldownSeconds}s)` : 'Gửi lại'}
                        </button>
                    </div>

                    <button
                        onClick={onCancel}
                        className="w-full text-sm text-slate-500 hover:text-slate-700 py-2"
                    >
                        Quay lại
                    </button>
                </div>
            )}

            {/* Success Message */}
            {success && (
                <div className="text-center text-green-600">
                    <p className="text-sm">Đang chuyển hướng...</p>
                </div>
            )}

            {/* CSS for shake animation */}
            <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
        </div>
    );
};

export default OtpInput;
