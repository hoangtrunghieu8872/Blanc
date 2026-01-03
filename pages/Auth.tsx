import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Card, Dropdown } from '../components/ui/Common';
import { api } from '../lib/api';
import { Check, User, Briefcase, MapPin, Code, Target, Shield, RefreshCw, FileText, ExternalLink } from 'lucide-react';

interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
}

interface RegisterInitiateResponse {
  ok: boolean;
  message: string;
  sessionToken: string;
  expiresAt: string;
}

interface LoginInitiateResponse {
  ok: boolean;
  requiresOTP: boolean;
  sessionToken?: string;
  message?: string;
  email?: string;
  expiresAt?: string;
  // For direct login (bypass OTP)
  token?: string;
  user?: {
    _id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
}

// Generate secure session token (32 bytes hex)
const generateSessionToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Simple OTP Input component for Auth page
// Dùng uncontrolled input để tránh conflict với bộ gõ tiếng Việt
const SimpleOtpInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync value to inputs khi value thay đổi từ bên ngoài (reset)
  useEffect(() => {
    inputRefs.current.forEach((input, i) => {
      if (input) {
        input.value = value[i] || '';
      }
    });
  }, [value]);

  const collectValue = () => {
    return inputRefs.current.map(input => input?.value || '').join('');
  };

  const handleInput = (index: number) => {
    const input = inputRefs.current[index];
    if (!input) return;

    // Chỉ giữ lại số
    const digit = input.value.replace(/\D/g, '').slice(-1);
    input.value = digit;

    onChange(collectValue());

    // Focus ô tiếp theo nếu đã nhập
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = inputRefs.current[index];

    if (e.key === 'Backspace') {
      if (!input?.value && index > 0) {
        e.preventDefault();
        const prevInput = inputRefs.current[index - 1];
        if (prevInput) {
          prevInput.value = '';
          prevInput.focus();
          onChange(collectValue());
        }
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);

    inputRefs.current.forEach((input, i) => {
      if (input) {
        input.value = pasted[i] || '';
      }
    });

    onChange(pasted);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div ref={containerRef} className="flex gap-3" onPaste={handlePaste}>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="tel"
          pattern="[0-9]*"
          maxLength={1}
          defaultValue=""
          onInput={() => handleInput(index)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          placeholder="•"
          autoComplete="off"
          data-form-type="other"
          className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-slate-300 bg-white outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      ))}
    </div>
  );
};

// Step Progress Indicator Component - Updated for 4 steps in registration
const StepProgress: React.FC<{ currentStep: number; isAnimating: boolean; totalSteps?: number }> = ({
  currentStep,
  isAnimating,
  totalSteps = 4
}) => {
  const steps = totalSteps === 4
    ? [{ label: 'Tài khoản', num: 1 }, { label: 'Xác thực', num: 2 }, { label: 'Hồ sơ', num: 3 }, { label: 'Điều khoản', num: 4 }]
    : [{ label: 'Tài khoản', num: 1 }, { label: 'Hồ sơ', num: 2 }];

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <React.Fragment key={step.num}>
          {/* Step Circle */}
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 ${currentStep > step.num
                ? 'bg-primary-600 text-white'
                : currentStep === step.num
                  ? 'bg-primary-600 text-white ring-4 ring-primary-100'
                  : 'border-2 border-slate-300 text-slate-400'
                }`}
            >
              {currentStep > step.num ? <Check className="w-5 h-5" /> : step.num}
            </div>
            <span className={`text-xs mt-2 font-medium ${currentStep >= step.num ? 'text-primary-600' : 'text-slate-400'}`}>
              {step.label}
            </span>
          </div>

          {/* Connecting Line */}
          {index < steps.length - 1 && (
            <div className="relative w-16 h-1 mx-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`absolute top-0 left-0 h-full bg-primary-600 rounded-full transition-all duration-700 ease-out ${isAnimating ? 'animate-pulse' : ''
                  } ${currentStep > step.num ? 'w-full' : 'w-0'}`}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const Auth: React.FC<{ type: 'login' | 'register' }> = ({ type }) => {
  const navigate = useNavigate();
  const isLogin = type === 'login';

  // Step state for registration (1: Account, 2: OTP, 3: Profile, 4: Terms)
  const [currentStep, setCurrentStep] = useState(1);

  // Terms acceptance state
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Form data for step 1
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  // Form data for step 3 (profile info)
  const [profileData, setProfileData] = useState({
    primaryRole: '',
    experienceLevel: '',
    location: '',
    skills: '',
    learningGoals: '',
  });

  // OTP related state
  const [sessionToken, setSessionToken] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);

  // 2FA state for login
  const [requires2FA, setRequires2FA] = useState(false);
  const [login2FASessionToken, setLogin2FASessionToken] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationVerificationToken, setRegistrationVerificationToken] = useState<string>('');

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // OTP expiration timer display
  const getExpirationDisplay = useCallback(() => {
    if (!otpExpiresAt) return '';
    const now = new Date();
    const diff = Math.max(0, Math.floor((otpExpiresAt.getTime() - now.getTime()) / 1000));
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [otpExpiresAt]);

  const [expirationDisplay, setExpirationDisplay] = useState('');

  useEffect(() => {
    if (otpExpiresAt) {
      const timer = setInterval(() => {
        setExpirationDisplay(getExpirationDisplay());
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [otpExpiresAt, getExpirationDisplay]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  // Handle step 1 submit (initiate registration with OTP)
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Generate session token for OTP verification
      const newSessionToken = generateSessionToken();

      // Step 1: Initiate registration with sessionToken
      const response = await api.post<RegisterInitiateResponse>('/auth/register/initiate', {
        ...formData,
        sessionToken: newSessionToken,
      });

      // Save session token for OTP verification
      setSessionToken(newSessionToken);

      // Step 2: Request OTP to be sent to email
      await api.post('/otp/request', {
        email: formData.email,
        sessionToken: newSessionToken,
        action: 'register_verify',
      });

      setOtpExpiresAt(new Date(response.expiresAt));
      setCountdown(60); // Start 60s countdown for resend

      // Start animation and move to step 2 (OTP)
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(2);
        setIsAnimating(false);
      }, 700);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
      const vietnameseErrors: Record<string, string> = {
        'User already exists.': 'Email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.',
        'Email đã được đăng ký.': 'Email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.',
        'Invalid credentials.': 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.',
        'Email and password are required.': 'Vui lòng nhập đầy đủ email và mật khẩu.',
        'Name, email, and password are required.': 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.',
        'Họ tên, email và mật khẩu là bắt buộc.': 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.',
      };
      setError(vietnameseErrors[errorMessage] || errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP verification for registration
  const handleOtpVerify = async () => {
    if (otp.length !== 6) {
      setOtpError('Vui lòng nhập đầy đủ 6 chữ số.');
      return;
    }

    setIsVerifying(true);
    setOtpError('');

    try {
      // Step 1: Verify OTP via /otp/verify endpoint
      const otpResult = await api.post<{
        ok: boolean;
        verificationToken: string;
        action: string;
      }>('/otp/verify', {
        email: formData.email,
        sessionToken,
        otp,
      });

      // Bind verification token for final registration step
      await api.post('/auth/register/verify', {
        email: formData.email,
        verificationToken: otpResult.verificationToken,
      });

      setRegistrationVerificationToken(otpResult.verificationToken);

      // Move to step 3 (Profile)
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(3);
        setIsAnimating(false);
      }, 700);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
      setOtpError(errorMessage);
      // Reset OTP input on error
      setOtp('');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle resend OTP for registration
  const handleResendOtp = async () => {
    if (countdown > 0 || isResending) return;

    setIsResending(true);
    setOtpError('');

    try {
      const newSessionToken = generateSessionToken();

      await api.post('/otp/request', {
        email: formData.email,
        sessionToken: newSessionToken,
        action: 'register_verify',
      });

      setSessionToken(newSessionToken);
      setOtpExpiresAt(new Date(Date.now() + 2 * 60 * 1000)); // 2 minutes
      setCountdown(60);
      setOtp('');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
      setOtpError(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  // Navigation helpers
  const goToTermsStep = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(4);
      setIsAnimating(false);
    }, 700);
  };

  const finishRegistration = () => {
    // Finalize registration only after terms are accepted
    // (Account is created here, not at OTP verification)
    const finalize = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (!registrationVerificationToken) {
          setError('Phiên xác thực đã hết hạn. Vui lòng đăng ký lại.');
          return;
        }

        if (!profileData.primaryRole || !profileData.experienceLevel) {
          setError('Vui lòng hoàn thiện hồ sơ (vai trò & cấp độ kinh nghiệm) trước khi tạo tài khoản.');
          setCurrentStep(3);
          return;
        }

        const response = await api.post<AuthResponse>('/auth/register/complete', {
          email: formData.email,
          verificationToken: registrationVerificationToken,
          profile: {
            primaryRole: profileData.primaryRole,
            experienceLevel: profileData.experienceLevel,
            location: profileData.location,
            skills: profileData.skills,
            learningGoals: profileData.learningGoals,
          },
          termsAccepted,
          privacyAccepted,
        });

        localStorage.setItem('user', JSON.stringify(response.user));
        window.dispatchEvent(new Event('auth-change'));
        navigate('/profile');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    void finalize();
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Account is not created yet, so we only collect profile data locally
    // but require minimum profile fields before moving forward.
    if (!profileData.primaryRole) {
      setError('Vui lòng chọn vai trò chính của bạn.');
      return;
    }

    if (!profileData.experienceLevel) {
      setError('Vui lòng chọn cấp độ kinh nghiệm của bạn.');
      return;
    }

    goToTermsStep();
  };

  // Handle login submit - always requires OTP verification
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Generate session token for OTP verification
      const newSessionToken = generateSessionToken();

      const response = await api.post<LoginInitiateResponse>('/auth/login/initiate', {
        email: formData.email,
        password: formData.password,
        sessionToken: newSessionToken,
      });

      if (response.requiresOTP) {
        // OTP verification required - send OTP via /otp/request
        const otpSessionToken = response.sessionToken || newSessionToken;

        await api.post('/otp/request', {
          email: formData.email,
          sessionToken: otpSessionToken,
          action: 'login_2fa',
        });

        setRequires2FA(true);
        setLogin2FASessionToken(otpSessionToken);
        setOtpExpiresAt(new Date(response.expiresAt || Date.now() + 2 * 60 * 1000));
        setCountdown(60);
      } else if (response.token && response.user) {
        // Direct login (OTP bypassed for test accounts)
        localStorage.setItem('user', JSON.stringify(response.user));
        window.dispatchEvent(new Event('auth-change'));
        navigate('/profile');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
      const vietnameseErrors: Record<string, string> = {
        'Invalid credentials.': 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.',
        'Email và mật khẩu không đúng.': 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.',
        'Email and password are required.': 'Vui lòng nhập đầy đủ email và mật khẩu.',
        'Valid session token is required.': 'Lỗi phiên làm việc. Vui lòng thử lại.',
      };
      setError(vietnameseErrors[errorMessage] || errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle 2FA verification for login
  const handleLogin2FAVerify = async () => {
    if (otp.length !== 6) {
      setOtpError('Vui lòng nhập đầy đủ 6 chữ số.');
      return;
    }

    setIsVerifying(true);
    setOtpError('');

    try {
      const response = await api.post<AuthResponse>('/auth/login/verify-2fa', {
        email: formData.email,
        sessionToken: login2FASessionToken,
        otp,
      });

      localStorage.setItem('user', JSON.stringify(response.user));
      window.dispatchEvent(new Event('auth-change'));
      navigate('/profile');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
      setOtpError(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle resend OTP for 2FA login
  const handleResend2FAOtp = async () => {
    if (countdown > 0 || isResending) return;

    setIsResending(true);
    setOtpError('');

    try {
      const newSessionToken = generateSessionToken();

      await api.post('/otp/request', {
        email: formData.email,
        sessionToken: newSessionToken,
        action: 'login_2fa',
      });

      setLogin2FASessionToken(newSessionToken);
      setOtpExpiresAt(new Date(Date.now() + 2 * 60 * 1000)); // 2 minutes
      setCountdown(60);
      setOtp('');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
      setOtpError(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  // Render Step 4 Form (Terms & Conditions)
  const renderTermsForm = () => (
    <div className="space-y-5">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <FileText className="w-8 h-8 text-primary-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Điều khoản sử dụng</h3>
        <p className="text-slate-600 text-sm">
          Vui lòng đọc và đồng ý với các điều khoản trước khi tiếp tục
        </p>
      </div>

      {/* Terms Summary Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-48 overflow-y-auto text-sm text-slate-600 space-y-3">
        <div>
          <h4 className="font-semibold text-slate-800 mb-1">📋 Điều khoản dịch vụ</h4>
          <p>Bằng việc sử dụng Blanc, bạn đồng ý tuân thủ các quy định về nội dung, hành vi và sử dụng dịch vụ của chúng tôi.</p>
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 mb-1">🔒 Chính sách bảo mật</h4>
          <p>Chúng tôi cam kết bảo vệ thông tin cá nhân của bạn và chỉ sử dụng cho mục đích cung cấp dịch vụ.</p>
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 mb-1">🤝 Quy tắc cộng đồng</h4>
          <p>Tôn trọng lẫn nhau, không spam, không chia sẻ nội dung vi phạm pháp luật.</p>
        </div>
      </div>

      {/* Checkbox Agreements */}
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
          <span className="text-sm text-slate-600 group-hover:text-slate-800">
            Tôi đã đọc và đồng ý với{' '}
            <a
              href="/terms"
              target="_blank"
              className="text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
            >
              Điều khoản sử dụng
              <ExternalLink className="w-3 h-3" />
            </a>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={privacyAccepted}
            onChange={(e) => setPrivacyAccepted(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
          <span className="text-sm text-slate-600 group-hover:text-slate-800">
            Tôi đã đọc và đồng ý với{' '}
            <a
              href="/privacy"
              target="_blank"
              className="text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
            >
              Chính sách bảo mật
              <ExternalLink className="w-3 h-3" />
            </a>
          </span>
        </label>
      </div>

      <Button
        type="button"
        className="w-full text-lg h-12"
        disabled={!termsAccepted || !privacyAccepted || isLoading}
        onClick={finishRegistration}
      >
        {isLoading ? 'Đang tạo tài khoản...' : 'Đồng ý và tạo tài khoản'}
      </Button>

      <p className="text-xs text-slate-400 text-center">
        Bằng việc tiếp tục, bạn xác nhận đã đủ 13 tuổi trở lên
      </p>
    </div>
  );

  // Render Step 1 Form (Account Info)
  const renderStep2Form = () => (
    <form className="space-y-5" onSubmit={handleStep1Submit}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Input
        label="Họ và tên"
        name="name"
        placeholder="Nguyễn Văn A"
        value={formData.name}
        onChange={handleChange}
        required
      />
      <Input
        label="Email"
        type="email"
        name="email"
        placeholder="example@email.com"
        value={formData.email}
        onChange={handleChange}
        required
      />
      <Input
        label="Mật khẩu"
        type="password"
        name="password"
        placeholder="••••••••"
        value={formData.password}
        onChange={handleChange}
        autoComplete="new-password"
        required
      />

      <div className="flex items-center text-sm">
        <label className="flex items-center text-slate-600">
          <input type="checkbox" className="mr-2 rounded text-primary-600 focus:ring-primary-500" />
          Ghi nhớ tôi
        </label>
      </div>

      <Button type="submit" className="w-full text-lg h-12" disabled={isLoading}>
        {isLoading ? 'Đang xử lý...' : 'Tiếp tục'}
      </Button>
    </form>
  );

  // Render Step 2 Form (OTP Verification)
  const renderStep3OtpForm = () => (
    <div className="space-y-5">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Shield className="w-8 h-8 text-primary-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Xác thực email</h3>
        <p className="text-slate-600 text-sm">
          Chúng tôi đã gửi mã xác thực đến{' '}
          <span className="font-semibold text-primary-600">{formData.email}</span>
        </p>
        {expirationDisplay && (
          <p className="text-xs text-slate-500 mt-2">
            Mã hết hạn sau: <span className="font-mono font-semibold">{expirationDisplay}</span>
          </p>
        )}
      </div>

      {otpError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {otpError}
        </div>
      )}

      <div className="flex justify-center">
        <SimpleOtpInput
          value={otp}
          onChange={setOtp}
          disabled={isVerifying}
        />
      </div>

      <Button
        type="button"
        className="w-full text-lg h-12"
        disabled={isVerifying || otp.length !== 6}
        onClick={handleOtpVerify}
      >
        {isVerifying ? 'Đang xác thực...' : 'Xác nhận'}
      </Button>

      <div className="text-center">
        <p className="text-sm text-slate-500 mb-2">Không nhận được mã?</p>
        <button
          type="button"
          onClick={handleResendOtp}
          disabled={countdown > 0 || isResending}
          className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${countdown > 0 || isResending
            ? 'text-slate-400 cursor-not-allowed'
            : 'text-primary-600 hover:text-primary-700'
            }`}
        >
          <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
          {countdown > 0 ? `Gửi lại sau ${countdown}s` : isResending ? 'Đang gửi...' : 'Gửi lại mã'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          setCurrentStep(1);
          setOtp('');
          setOtpError('');
        }}
        className="w-full text-sm text-slate-500 hover:text-slate-700 mt-2"
      >
        ← Quay lại
      </button>
    </div>
  );

  // Render Step 3 Form (Profile Info)
  const renderStep4Form = () => (
    <form className="space-y-4" onSubmit={handleStep3Submit}>
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <User className="w-8 h-8 text-primary-600" />
        </div>
        <p className="text-slate-600 text-sm">
          Chào <span className="font-semibold text-primary-600">{formData.name}</span>!
          Hãy cho chúng tôi biết thêm về bạn.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Primary Role */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-slate-400" />
          Vai trò chính của bạn
        </label>
        <Dropdown
          value={profileData.primaryRole}
          onChange={(value) => handleProfileChange({ target: { name: 'primaryRole', value } } as React.ChangeEvent<HTMLInputElement>)}
          placeholder="Chọn vai trò..."
          headerText="Chọn vai trò"
          options={[
            { value: '', label: 'Chọn vai trò...' },
            { value: 'developer', label: 'Lập trình viên' },
            { value: 'designer', label: 'Thiết kế' },
            { value: 'product', label: 'Product Manager' },
            { value: 'data', label: 'Data/AI' },
            { value: 'business', label: 'Kinh doanh' },
            { value: 'student', label: 'Sinh viên' },
            { value: 'other', label: 'Khác' }
          ]}
        />
      </div>

      {/* Experience Level */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
          <Target className="w-4 h-4 text-slate-400" />
          Cấp độ kinh nghiệm
        </label>
        <Dropdown
          value={profileData.experienceLevel}
          onChange={(value) => handleProfileChange({ target: { name: 'experienceLevel', value } } as React.ChangeEvent<HTMLInputElement>)}
          placeholder="Chọn cấp độ..."
          headerText="Chọn cấp độ"
          options={[
            { value: '', label: 'Chọn cấp độ...' },
            { value: 'beginner', label: 'Mới bắt đầu (0-1 năm)' },
            { value: 'junior', label: 'Junior (1-2 năm)' },
            { value: 'middle', label: 'Middle (2-4 năm)' },
            { value: 'senior', label: 'Senior (4+ năm)' },
            { value: 'expert', label: 'Expert/Lead' }
          ]}
        />
      </div>

      {/* Location */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-400" />
          Địa điểm
        </label>
        <Input
          name="location"
          placeholder="Ví dụ: Hà Nội, TP.HCM..."
          value={profileData.location}
          onChange={handleProfileChange}
        />
      </div>

      {/* Skills */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
          <Code className="w-4 h-4 text-slate-400" />
          Kỹ năng chính
        </label>
        <Input
          name="skills"
          placeholder="React, Python, Design... (ngăn cách bằng dấu phẩy)"
          value={profileData.skills}
          onChange={handleProfileChange}
        />
      </div>

      {/* Learning Goals */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Mục tiêu học tập
        </label>
        <textarea
          name="learningGoals"
          placeholder="Bạn muốn đạt được điều gì khi tham gia Blanc?"
          value={profileData.learningGoals}
          onChange={handleProfileChange}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1 h-11" disabled={isLoading}>
          {isLoading ? 'Đang xử lý...' : 'Tiếp tục'}
        </Button>
      </div>
    </form>
  );

  // Render Login Form
  const renderLoginForm = () => (
    <form className="space-y-5" onSubmit={handleLoginSubmit}>
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
        value={formData.email}
        onChange={handleChange}
        required
      />
      <Input
        label="Mật khẩu"
        type="password"
        name="password"
        placeholder="••••••••"
        value={formData.password}
        onChange={handleChange}
        autoComplete="current-password"
        required
      />

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center text-slate-600">
          <input type="checkbox" className="mr-2 rounded text-primary-600 focus:ring-primary-500" />
          Ghi nhớ tôi
        </label>
        <span onClick={() => navigate('/forgot-password')} className="text-primary-600 hover:text-primary-700 font-medium cursor-pointer">
          Quên mật khẩu?
        </span>
      </div>

      <Button type="submit" className="w-full text-lg h-12" disabled={isLoading}>
        {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
      </Button>
    </form>
  );

  // Render 2FA OTP verification for login
  const render2FAForm = () => (
    <div className="space-y-5">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Shield className="w-8 h-8 text-primary-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Xác thực 2 bước</h3>
        <p className="text-slate-600 text-sm">
          Nhập mã xác thực đã gửi đến{' '}
          <span className="font-semibold text-primary-600">{formData.email}</span>
        </p>
        {expirationDisplay && (
          <p className="text-xs text-slate-500 mt-2">
            Mã hết hạn sau: <span className="font-mono font-semibold">{expirationDisplay}</span>
          </p>
        )}
      </div>

      {otpError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {otpError}
        </div>
      )}

      <div className="flex justify-center">
        <SimpleOtpInput
          value={otp}
          onChange={setOtp}
          disabled={isVerifying}
        />
      </div>

      <Button
        type="button"
        className="w-full text-lg h-12"
        disabled={isVerifying || otp.length !== 6}
        onClick={handleLogin2FAVerify}
      >
        {isVerifying ? 'Đang xác thực...' : 'Đăng nhập'}
      </Button>

      <div className="text-center">
        <p className="text-sm text-slate-500 mb-2">Không nhận được mã?</p>
        <button
          type="button"
          onClick={handleResend2FAOtp}
          disabled={countdown > 0 || isResending}
          className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${countdown > 0 || isResending
            ? 'text-slate-400 cursor-not-allowed'
            : 'text-primary-600 hover:text-primary-700'
            }`}
        >
          <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
          {countdown > 0 ? `Gửi lại sau ${countdown}s` : isResending ? 'Đang gửi...' : 'Gửi lại mã'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          setRequires2FA(false);
          setOtp('');
          setOtpError('');
        }}
        className="w-full text-sm text-slate-500 hover:text-slate-700 mt-2"
      >
        ← Quay lại đăng nhập
      </button>
    </div>
  );

  // Get title and subtitle based on current state
  const getHeaderContent = () => {
    if (isLogin) {
      if (requires2FA) {
        return {
          title: 'Xác thực bảo mật',
          subtitle: 'Vui lòng nhập mã OTP để hoàn tất đăng nhập.'
        };
      }
      return {
        title: 'Chào mừng trở lại!',
        subtitle: 'Nhập thông tin để tiếp tục hành trình học tập.'
      };
    }

    switch (currentStep) {
      case 1:
        return {
          title: 'Tạo tài khoản mới',
          subtitle: 'Tham gia cộng đồng học tập lớn nhất Việt Nam.'
        };
      case 2:
        return {
          title: 'Xác thực email',
          subtitle: 'Nhập mã OTP đã gửi đến email của bạn.'
        };
      case 3:
        return {
          title: 'Hoàn thiện hồ sơ',
          subtitle: 'Giúp chúng tôi hiểu bạn hơn để gợi ý phù hợp.'
        };
      case 4:
        return {
          title: 'Điều khoản sử dụng',
          subtitle: 'Vui lòng đọc và đồng ý với các điều khoản của chúng tôi.'
        };
      default:
        return { title: '', subtitle: '' };
    }
  };

  // Get right panel content based on current state
  const getRightPanelContent = () => {
    if (isLogin && requires2FA) {
      return {
        title: 'Bảo mật tài khoản',
        description: 'Xác thực 2 bước giúp bảo vệ tài khoản của bạn khỏi truy cập trái phép.'
      };
    }
    if (!isLogin && currentStep === 4) {
      return {
        title: 'Chào mừng đến Blanc!',
        description: 'Trước khi bắt đầu, hãy dành chút thời gian để đọc các điều khoản của chúng tôi.'
      };
    }
    if (!isLogin && currentStep === 2) {
      return {
        title: 'Xác thực email',
        description: 'Chúng tôi cần xác nhận email để đảm bảo tính bảo mật cho tài khoản của bạn.'
      };
    }
    if (!isLogin && currentStep === 3) {
      return {
        title: 'Sắp hoàn tất!',
        description: 'Thông tin của bạn sẽ giúp chúng tôi gợi ý cuộc thi và đồng đội phù hợp nhất.'
      };
    }
    return {
      title: 'Học tập không giới hạn',
      description: '"Giáo dục là vũ khí mạnh nhất mà bạn có thể dùng để thay đổi thế giới." - Nelson Mandela'
    };
  };

  const { title, subtitle } = getHeaderContent();
  const rightPanel = getRightPanelContent();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 overflow-hidden shadow-xl border-0">

        {/* Left: Form */}
        <div className="p-8 md:p-10 flex flex-col justify-center">
          {/* Step Progress for Registration */}
          {!isLogin && <StepProgress currentStep={currentStep} isAnimating={isAnimating} totalSteps={4} />}

          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{title}</h2>
            <p className="text-slate-500 text-sm">{subtitle}</p>
          </div>

          {/* Render appropriate form */}
          {isLogin
            ? requires2FA
              ? render2FAForm()
              : renderLoginForm()
            : currentStep === 1
              ? renderStep2Form()
              : currentStep === 2
                ? renderStep3OtpForm()
                : currentStep === 3
                  ? renderStep4Form()
                  : renderTermsForm()}

          {/* Footer link - only show for step 1 or login (without 2FA) */}
          {((isLogin && !requires2FA) || (!isLogin && currentStep === 1)) && (
            <div className="mt-6 text-center text-sm text-slate-500">
              {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
              <span
                onClick={() => navigate(isLogin ? '/register' : '/login')}
                className="text-primary-600 hover:text-primary-700 font-bold cursor-pointer"
              >
                {isLogin ? "Đăng ký ngay" : "Đăng nhập ngay"}
              </span>
            </div>
          )}
        </div>

        {/* Right: Decoration */}
        <div className="hidden md:flex bg-primary-600 p-12 flex-col justify-between text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-4">{rightPanel.title}</h3>
            <p className="text-primary-100">{rightPanel.description}</p>
          </div>

          {/* Abstract shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-white opacity-10 rounded-full -translate-x-1/3 translate-y-1/3"></div>

          {/* Step indicator dots */}
          {!isLogin && (
            <div className="relative z-10 flex gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full transition-all duration-500 ${currentStep >= 1 ? 'bg-white' : 'bg-white/30'}`} />
              <div className={`w-2 h-2 rounded-full transition-all duration-500 ${currentStep >= 2 ? 'bg-white' : 'bg-white/30'}`} />
              <div className={`w-2 h-2 rounded-full transition-all duration-500 ${currentStep >= 3 ? 'bg-white' : 'bg-white/30'}`} />
              <div className={`w-2 h-2 rounded-full transition-all duration-500 ${currentStep >= 4 ? 'bg-white' : 'bg-white/30'}`} />
            </div>
          )}

          <div className="relative z-10 text-sm opacity-80">© 2024 Blanc Inc.</div>
        </div>

      </Card>
    </div>
  );
};

export default Auth;
