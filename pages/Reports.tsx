import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { Card } from '../components/ui/Common';
import { api } from '../lib/api';
import MyReportsPanel from '../components/reports/MyReportsPanel';
import MentorReviewPanel from '../components/reports/MentorReviewPanel';
import { isMentorRole } from '../components/reports/reportUtils';
import { MembershipEntitlements, User } from '../types';

type TabKey = 'my' | 'review';

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

const Reports: React.FC = () => {
  const me = useMemo(() => getStoredUser(), []);
  const canReview = useMemo(() => isMentorRole(me?.role), [me?.role]);

  const [tab, setTab] = useState<TabKey>('my');
  const [entitlements, setEntitlements] = useState<MembershipEntitlements | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const data = await api.get<{ entitlements: MembershipEntitlements }>('/membership/me');
        setEntitlements(data.entitlements || null);
      } catch {
        setEntitlements(null);
      }
    };
    void run();
  }, []);

  const isLocked = false;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo cáo cá nhân</h1>
          <p className="text-sm text-slate-600 mt-1">Cập nhật thành tích, thêm minh chứng, gửi mentor review và theo dõi feedback.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${tab === 'my'
              ? 'bg-white text-slate-900 border-slate-200'
              : 'bg-transparent text-slate-600 border-transparent hover:border-slate-200'
              }`}
            onClick={() => setTab('my')}
          >
            Báo cáo của tôi
          </button>
          {canReview && (
            <button
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${tab === 'review'
                ? 'bg-white text-slate-900 border-slate-200'
                : 'bg-transparent text-slate-600 border-transparent hover:border-slate-200'
                }`}
              onClick={() => setTab('review')}
            >
              Mentor review
            </button>
          )}
        </div>

        {tab === 'my' && isLocked && (
          <Card className="p-4 border-amber-100 bg-amber-50">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-700 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-amber-900">Reports đang bị khóa theo gói membership</p>
                <p className="text-sm text-amber-800 mt-0.5">Bạn cần nâng cấp gói để tạo/cập nhật báo cáo.</p>
              </div>
            </div>
          </Card>
        )}

        {tab === 'my' ? <MyReportsPanel isLocked={isLocked} /> : canReview ? <MentorReviewPanel /> : null}
      </div>
    </div>
  );
};

export default Reports;
