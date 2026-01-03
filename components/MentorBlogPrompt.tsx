import React from 'react';
import { Button, Card } from './ui/Common';

interface MentorBlogPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const MentorBlogPrompt: React.FC<MentorBlogPromptProps> = ({ isOpen, onClose, onUpdate }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <Card className="w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-900">Cap nhat blog ca nhan</h3>
        <p className="mt-2 text-sm text-slate-600">
          Ban chua hoan thanh blog ca nhan. Hay bo sung banner va noi dung gioi thieu.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            De sau
          </Button>
          <Button size="sm" onClick={onUpdate}>
            Cap nhat thong tin
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default MentorBlogPrompt;
