import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Copy, Crown, Loader2, Timer, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { CACHE_TTL } from '../lib/cache';
import { MembershipEntitlements, MembershipSummary, MembershipTier } from '../types';
import { Button, Card, Badge, cn } from './ui/Common';
import { fireFireworks } from '../lib/fireworks';

interface MembershipPlan {
  id: MembershipTier;
  tier: MembershipTier;
  name: string;
  priceVnd: number;
  durationDays: number;
  highlights?: string[];
  entitlements?: MembershipEntitlements;
}

interface CheckoutResponse {
  order: {
    id: string;
    status: string;
    provider: string;
    plan: {
      id: MembershipTier;
      tier: MembershipTier;
      name: string;
      priceVnd: number;
      durationDays: number;
    };
    orderCode: string;
    amountVnd: number;
    expiresAt: string;
  };
  payment: {
    bank: {
      bankCode: string;
      accountNumber: string;
      accountName: string;
    };
    transferContent: string;
    qrUrl: string | null;
  };
}

interface OrderStatusResponse {
  order: {
    id: string;
    status: 'pending' | 'paid' | 'needs_review' | string;
    provider: string;
    planId?: string;
    tier?: MembershipTier;
    amountVnd?: number;
    currency?: string;
    orderCode?: string;
    createdAt?: string | null;
    expiresAt?: string | null;
    paidAt?: string | null;
  };
}

const BUSINESS_CONTACT_EMAIL = 'dangthhfct31147@gmail.com';

const tierLabel = (tier: MembershipTier) =>
  tier === 'plus' ? 'Plus' : tier === 'pro' ? 'Pro' : tier === 'business' ? 'Business' : 'Free';

const tierBadgeClass = (tier: MembershipTier) =>
  tier === 'business'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : tier === 'pro'
      ? 'bg-purple-50 text-purple-700 border-purple-100'
      : tier === 'plus'
        ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
        : 'bg-slate-100 text-slate-700 border-slate-200';

const formatVnd = (amount: number) => `${Math.max(0, amount || 0).toLocaleString('vi-VN')} ₫`;

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('vi-VN');
};

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success('Đã copy');
  } catch {
    toast.error('Không thể copy, hãy copy thủ công');
  }
}

async function syncMe() {
  try {
    const me = await api.get<{ user: unknown }>('/auth/me');
    if (me?.user) {
      localStorage.setItem('user', JSON.stringify(me.user));
      window.dispatchEvent(new Event('auth-change'));
    }
  } catch {
    // ignore
  }
}

const MembershipManager: React.FC = () => {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [entitlements, setEntitlements] = useState<MembershipEntitlements | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatusResponse['order'] | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [plansRes, meRes] = await Promise.all([
        api.get<{ plans: MembershipPlan[] }>('/membership/plans', {
          useCache: true,
          cacheTTL: CACHE_TTL.MEMBERSHIP_PLANS,
          cacheKey: 'membership:plans',
          persist: 'local',
        }),
        api.get<{ membership: MembershipSummary; entitlements: MembershipEntitlements }>('/membership/me'),
      ]);

      setPlans(plansRes.plans || []);
      setMembership(meRes.membership || null);
      setEntitlements(meRes.entitlements || null);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải thông tin gói');
      setPlans([]);
      setMembership(null);
      setEntitlements(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [load]);

  const effectiveTier: MembershipTier = (membership?.effectiveTier || membership?.tier || 'free') as MembershipTier;

  const checkoutExpired = useMemo(() => {
    const expiresAt = checkout?.order?.expiresAt;
    if (!expiresAt) return false;
    const d = new Date(expiresAt);
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
  }, [checkout?.order?.expiresAt]);

  const closeCheckout = () => {
    setCheckout(null);
    setOrderStatus(null);
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = useCallback((orderId: string) => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }

    pollRef.current = window.setInterval(async () => {
      try {
        const res = await api.get<OrderStatusResponse>(`/membership/orders/${orderId}`);
        const order = res?.order;
        if (!order) return;
        setOrderStatus(order);

        if (order.status === 'paid') {
          window.clearInterval(pollRef.current!);
          pollRef.current = null;

          toast.success('Thanh toán thành công!');
          await fireFireworks();
          await syncMe();
          await load();
          closeCheckout();
        }

        if (order.status === 'needs_review') {
          window.clearInterval(pollRef.current!);
          pollRef.current = null;
          toast('Đơn cần kiểm tra thủ công. Vui lòng liên hệ admin.', { icon: '⚠️' as any });
        }
      } catch {
        // ignore transient polling errors
      }
    }, 3000);
  }, [load]);

  const createOrder = async (plan: MembershipPlan) => {
    setIsCreatingOrder(true);
    try {
      const res = await api.post<CheckoutResponse>('/membership/checkout', { planId: plan.id });
      setCheckout(res);
      setOrderStatus({ ...res.order, status: 'pending' } as any);
      startPolling(res.order.id);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tạo đơn thanh toán');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const PlanGrid = useMemo(() => {
    if (plans.length === 0) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = effectiveTier === plan.tier;
          const isBusiness = plan.tier === 'business';
          const isLowerTier =
            (effectiveTier === 'business' && plan.tier !== 'business') ||
            (effectiveTier === 'pro' && (plan.tier === 'plus' || plan.tier === 'free')) ||
            (effectiveTier === 'plus' && plan.tier === 'free');

          return (
            <Card key={plan.id} className={cn('p-6', isCurrent && 'ring-2 ring-primary-200')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">{plan.name}</h4>
                  <p className="text-sm text-slate-500 mt-1">
                    {isBusiness ? 'Liên hệ' : `${formatVnd(plan.priceVnd)} / ${plan.durationDays} ngày`}
                  </p>
                </div>
                <Badge className={tierBadgeClass(plan.tier)}>{tierLabel(plan.tier)}</Badge>
              </div>

              {plan.highlights?.length ? (
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {plan.highlights.slice(0, 5).map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-5">
                <Button
                  className="w-full"
                  variant={isCurrent ? 'secondary' : 'primary'}
                  disabled={isCurrent || isLowerTier || (!isBusiness && isCreatingOrder)}
                  onClick={() => {
                    if (isBusiness) {
                      const subject = encodeURIComponent('Liên hệ gói Business');
                      window.location.href = `mailto:${BUSINESS_CONTACT_EMAIL}?subject=${subject}`;
                      return;
                    }
                    createOrder(plan);
                  }}
                >
                  {isCurrent ? 'Đang sử dụng' : isLowerTier ? 'Không khả dụng' : isBusiness ? 'Liên hệ ngay' : 'Đăng ký gói'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }, [effectiveTier, isCreatingOrder, plans]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary-600" />
              Gói đăng ký
            </h3>
            <p className="text-sm text-slate-500 mt-1">Quản lý gói Plus / Pro / Business của bạn</p>
          </div>

          <div className="flex flex-col sm:items-end gap-1">
            <Badge className={tierBadgeClass(effectiveTier)}>{tierLabel(effectiveTier)}</Badge>
            <p className="text-xs text-slate-500">
              Hết hạn: <span className="font-medium text-slate-700">{formatDateTime(membership?.expiresAt)}</span>
            </p>
            {entitlements ? (
              <p className="text-xs text-slate-500">
                Chat: <span className="font-medium text-slate-700">{entitlements.chatMessagesPerHour}/giờ</span>
                {' • '}
                Reports: <span className="font-medium text-slate-700">{entitlements.reportsEnabled ? 'Có' : 'Không'}</span>
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {PlanGrid}

      {checkout ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeCheckout} aria-hidden="true" />
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Thanh toán qua chuyển khoản</h4>
                <p className="text-sm text-slate-500 mt-1">
                  Đơn <span className="font-mono text-slate-700">{checkout.order.orderCode}</span> • {formatVnd(checkout.order.amountVnd)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCheckout}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                aria-label="Close"
                title="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Trạng thái</span>
                  <span className="text-sm text-slate-700">
                    {orderStatus?.status === 'paid' ? 'Đã thanh toán' : checkoutExpired ? 'Hết hạn' : 'Đang chờ'}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Ngân hàng</span>
                    <span className="text-sm font-medium text-slate-800">{checkout.payment.bank.bankCode || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Số tài khoản</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 font-mono">
                        {checkout.payment.bank.accountNumber || '-'}
                      </span>
                      {checkout.payment.bank.accountNumber ? (
                        <button
                          type="button"
                          onClick={() => copyText(checkout.payment.bank.accountNumber)}
                          className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-600"
                          title="Copy"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Chủ tài khoản</span>
                    <span className="text-sm font-medium text-slate-800">{checkout.payment.bank.accountName || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Nội dung CK</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 font-mono">
                        {checkout.payment.transferContent}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(checkout.payment.transferContent)}
                        className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-600"
                        title="Copy"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-slate-500">
                  <Timer className="w-4 h-4 mt-0.5 text-slate-400" />
                  <span>
                    Hạn thanh toán: <span className="font-medium text-slate-700">{formatDateTime(checkout.order.expiresAt)}</span>. Nếu đã chuyển khoản nhưng chưa cập nhật, vui lòng chờ 1-2 phút.
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Quét QR để chuyển khoản</p>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-center">
                  {checkout.payment.qrUrl ? (
                    <img
                      src={checkout.payment.qrUrl}
                      alt="VietQR"
                      className="w-full max-w-[340px] rounded-xl"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-sm text-slate-500">Chưa cấu hình ngân hàng (PAYMENT_BANK_*)</div>
                  )}
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    if (!checkout?.order?.id) return;
                    toast('Đang kiểm tra trạng thái...', { icon: '⏳' as any });
                  }}
                >
                  {pollRef.current ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang tự động cập nhật
                    </>
                  ) : (
                    'Đang chờ thanh toán'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MembershipManager;
