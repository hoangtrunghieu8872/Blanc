import React from 'react';
import { X } from 'lucide-react';
import { Button, Dropdown, Input } from '../ui/Common';

export type CreateTemplateKey = 'personal' | 'contest' | 'course';

export interface ContestOption {
  id: string;
  title: string;
}

export interface CreateReportModalProps {
  isOpen: boolean;
  isLocked: boolean;
  template: CreateTemplateKey;
  title: string;
  contestId: string;
  contests: ContestOption[];
  onChangeTemplate: (value: CreateTemplateKey) => void;
  onChangeTitle: (value: string) => void;
  onChangeContestId: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
}

const CreateReportModal: React.FC<CreateReportModalProps> = ({
  isOpen,
  isLocked,
  template,
  title,
  contestId,
  contests,
  onChangeTemplate,
  onChangeTitle,
  onChangeContestId,
  onClose,
  onCreate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <p className="font-semibold text-slate-900">Tạo báo cáo</p>
          <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <Dropdown
            label="Loại báo cáo"
            headerText="Loại báo cáo"
            value={template}
            onChange={(value) => onChangeTemplate(value as CreateTemplateKey)}
            disabled={isLocked}
            options={[
              { value: 'personal', label: 'Báo cáo cá nhân' },
              { value: 'contest', label: 'Tổng kết cuộc thi' },
              { value: 'course', label: 'Tiến độ khóa học' },
            ]}
          />

          {template === 'contest' && (
            <Dropdown
              label="Cuộc thi (từ lịch/đăng ký)"
              headerText="Chọn cuộc thi"
              placeholder="-- Chọn --"
              value={contestId}
              onChange={onChangeContestId}
              disabled={isLocked}
              options={[
                { value: '', label: '-- Chọn --' },
                ...contests.map((c) => ({ value: c.id, label: c.title })),
              ]}
            />
          )}

          <Input
            label="Tiêu đề"
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="VD: Báo cáo tuần 3, Tổng kết Hackathon..."
            disabled={isLocked}
          />
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={onCreate} disabled={isLocked}>
            Tạo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateReportModal;
