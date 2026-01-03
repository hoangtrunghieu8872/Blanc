import React, { useState, useEffect } from 'react';
import {
  Globe,
  Bell,
  Shield,
  Megaphone,
  Save,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Mail,
  Copy,
  Check,
  Loader2,
  Send,
  Users,
  AlertCircle
} from 'lucide-react';
import { generateSystemAnnouncement } from '../services/geminiService';
import { settingsService } from '../services/settingsService';
import { Dropdown } from './ui/Dropdown';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'security' | 'announcements'>('general');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  // AI State
  const [announceTopic, setAnnounceTopic] = useState('');
  const [announceAudience, setAnnounceAudience] = useState('All Users');
  const [generatedAnnouncement, setGeneratedAnnouncement] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Email State
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'students' | 'admins'>('all');
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // Settings State - loaded from settingsService
  const [settings, setSettings] = useState({
    siteName: 'Blanc',
    supportEmail: 'support@blanc.edu.vn',
    maintenanceMode: false,
    emailNotifs: true,
    pushNotifs: false,
    marketingEmails: true,
    twoFactor: true,
    sessionTimeout: '30'
  });

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await settingsService.getAll();
        setSettings({
          siteName: data.general.siteName,
          supportEmail: data.general.supportEmail,
          maintenanceMode: data.general.maintenanceMode,
          emailNotifs: data.notifications.emailNotifications,
          pushNotifs: data.notifications.pushNotifications,
          marketingEmails: data.notifications.marketingEmails,
          twoFactor: data.security.twoFactorRequired,
          sessionTimeout: String(data.security.sessionTimeout),
        });
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save all settings
      await settingsService.updateGeneral({
        siteName: settings.siteName,
        supportEmail: settings.supportEmail,
        maintenanceMode: settings.maintenanceMode,
      });
      await settingsService.updateNotifications({
        emailNotifications: settings.emailNotifs,
        pushNotifications: settings.pushNotifs,
        marketingEmails: settings.marketingEmails,
      });
      await settingsService.updateSecurity({
        twoFactorRequired: settings.twoFactor,
        sessionTimeout: parseInt(settings.sessionTimeout),
      });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Không thể lưu cài đặt. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleResetSessions = async () => {
    if (!window.confirm('Bạn có chắc muốn đăng xuất tất cả các phiên làm việc? Tất cả người dùng sẽ phải đăng nhập lại.')) {
      return;
    }
    setIsResetting(true);
    try {
      const result = await settingsService.resetAllSessions();
      alert(`Đã đăng xuất ${result.sessionsCleared} phiên làm việc thành công.`);
    } catch (error) {
      console.error('Failed to reset sessions:', error);
      alert('Không thể reset sessions. Vui lòng thử lại.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!announceTopic) return;
    setIsGenerating(true);
    const result = await generateSystemAnnouncement(announceTopic, announceAudience);
    setGeneratedAnnouncement(result);
    setIsGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedAnnouncement);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) return;
    setIsSendingTest(true);
    setEmailResult(null);
    try {
      const result = await settingsService.sendTestEmail(testEmail);
      setEmailResult({ success: true, message: result.message });
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Không thể gửi email test';
      setEmailResult({ success: false, message });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastSubject || !broadcastContent) {
      alert('Vui lòng nhập tiêu đề và nội dung');
      return;
    }
    if (!window.confirm('Bạn có chắc muốn gửi email này tới tất cả người dùng?')) {
      return;
    }
    setIsBroadcasting(true);
    setEmailResult(null);
    try {
      const result = await settingsService.broadcastEmail({
        subject: broadcastSubject,
        content: broadcastContent,
        audience: broadcastAudience,
      });
      setEmailResult({ success: true, message: result.message });
      setBroadcastSubject('');
      setBroadcastContent('');
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Không thể gửi broadcast';
      setEmailResult({ success: false, message });
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleUseAnnouncement = () => {
    if (generatedAnnouncement) {
      setBroadcastSubject(announceTopic || 'Thông báo từ Blanc');
      setBroadcastContent(generatedAnnouncement);
      setActiveTab('notifications');
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'announcements', label: 'Announcements (AI)', icon: Megaphone },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-500 mt-1">Manage platform preferences and system configuration</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white transition-all shadow-sm font-medium ${isSaved ? 'bg-green-600' : isSaving ? 'bg-emerald-400' : 'bg-emerald-600 hover:bg-emerald-700'
            } disabled:cursor-not-allowed`}
        >
          {isSaving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isSaved ? (
            <Check size={18} />
          ) : (
            <Save size={18} />
          )}
          {isSaving ? 'Đang lưu...' : isSaved ? 'Đã lưu!' : 'Lưu thay đổi'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <nav className="flex flex-col">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-l-4 ${activeTab === tab.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[500px]">

            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6 animate-fade-in-up">
                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">General Information</h3>
                <div className="grid gap-6 max-w-xl">
                  <div>
                    <label htmlFor="platform-name" className="block text-sm font-medium text-gray-700 mb-1">Platform Name</label>
                    <input
                      id="platform-name"
                      type="text"
                      value={settings.siteName}
                      onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                      placeholder="Enter platform name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="support-email" className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
                    <input
                      id="support-email"
                      type="email"
                      value={settings.supportEmail}
                      onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                      placeholder="support@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="font-medium text-gray-900">Maintenance Mode</p>
                      <p className="text-xs text-gray-500">Disable access for non-admin users</p>
                    </div>
                    <button
                      onClick={() => handleToggle('maintenanceMode')}
                      className={`text-2xl transition-colors ${settings.maintenanceMode ? 'text-emerald-600' : 'text-gray-300'}`}
                    >
                      {settings.maintenanceMode ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6 animate-fade-in-up">
                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Notification Preferences</h3>
                <div className="space-y-4 max-w-xl">
                  <div className="flex items-center justify-between py-3 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Mail size={20} /></div>
                      <div>
                        <p className="font-medium text-gray-900">Email Notifications</p>
                        <p className="text-xs text-gray-500">Receive system updates via email</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggle('emailNotifs')}
                      className={`text-2xl transition-colors ${settings.emailNotifs ? 'text-emerald-600' : 'text-gray-300'}`}
                    >
                      {settings.emailNotifs ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                    </button>
                  </div>
                </div>

                {/* Email Result Alert */}
                {emailResult && (
                  <div className={`p-4 rounded-lg flex items-center gap-3 ${emailResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {emailResult.success ? <Check size={20} /> : <AlertCircle size={20} />}
                    <p className="text-sm">{emailResult.message}</p>
                    <button
                      onClick={() => setEmailResult(null)}
                      className="ml-auto text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Test Email Section */}
                <div className="border-t border-gray-100 pt-6 mt-6">
                  <h4 className="font-medium text-gray-900 mb-4">Gửi Email Test</h4>
                  <div className="flex gap-3 max-w-xl">
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="Nhập email để test..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button
                      onClick={handleSendTestEmail}
                      disabled={!testEmail || isSendingTest || !settings.emailNotifs}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSendingTest ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Gửi Test
                    </button>
                  </div>
                  {!settings.emailNotifs && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Bật Email Notifications để gửi email
                    </p>
                  )}
                </div>

                {/* Broadcast Email Section */}
                <div className="border-t border-gray-100 pt-6 mt-6">
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Users size={18} />
                    Broadcast Email cho Users
                  </h4>
                  <div className="space-y-4 max-w-xl">
                    <div>
                      <Dropdown
                        label="Đối tượng"
                        options={[
                          { value: 'all', label: 'Tất cả người dùng', color: 'bg-blue-500' },
                          { value: 'students', label: 'Chỉ sinh viên', color: 'bg-green-500' },
                          { value: 'admins', label: 'Chỉ admin', color: 'bg-purple-500' }
                        ]}
                        value={broadcastAudience}
                        onChange={(val) => setBroadcastAudience(val as any)}
                        placeholder="Chọn đối tượng"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề</label>
                      <input
                        type="text"
                        value={broadcastSubject}
                        onChange={(e) => setBroadcastSubject(e.target.value)}
                        placeholder="Tiêu đề email..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung</label>
                      <textarea
                        value={broadcastContent}
                        onChange={(e) => setBroadcastContent(e.target.value)}
                        placeholder="Nội dung email... (Dùng {{name}} để chèn tên người nhận)"
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                      />
                    </div>
                    <button
                      onClick={handleBroadcast}
                      disabled={!broadcastSubject || !broadcastContent || isBroadcasting || !settings.emailNotifs}
                      className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                    >
                      {isBroadcasting ? <Loader2 size={18} className="animate-spin" /> : <Megaphone size={18} />}
                      {isBroadcasting ? 'Đang gửi...' : 'Gửi Broadcast'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6 animate-fade-in-up">
                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Security Settings</h3>
                <div className="max-w-xl space-y-6">
                  <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                    <div>
                      <p className="font-medium text-gray-900">Two-Factor Authentication (2FA)</p>
                      <p className="text-xs text-gray-500">Require 2FA for all admin accounts</p>
                    </div>
                    <button
                      onClick={() => handleToggle('twoFactor')}
                      className={`text-2xl transition-colors ${settings.twoFactor ? 'text-emerald-600' : 'text-gray-300'}`}
                    >
                      {settings.twoFactor ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                    </button>
                  </div>
                  <div>
                    <Dropdown
                      label="Session Timeout (minutes)"
                      options={[
                        { value: '15', label: '15 Minutes' },
                        { value: '30', label: '30 Minutes' },
                        { value: '60', label: '1 Hour' },
                        { value: '120', label: '2 Hours' }
                      ]}
                      value={settings.sessionTimeout}
                      onChange={(val) => setSettings({ ...settings, sessionTimeout: val })}
                      placeholder="Select timeout"
                    />
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={handleResetSessions}
                      disabled={isResetting}
                      className="text-red-600 text-sm font-medium hover:text-red-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isResetting && <Loader2 size={14} className="animate-spin" />}
                      {isResetting ? 'Đang reset...' : 'Reset all sessions'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AI Announcements Tab */}
            {activeTab === 'announcements' && (
              <div className="space-y-6 animate-fade-in-up h-full flex flex-col">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <Sparkles className="text-emerald-600" />
                  <h3 className="text-lg font-semibold text-gray-900">AI Announcement Generator</h3>
                </div>

                <div className="grid lg:grid-cols-2 gap-8 flex-1">
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Use Gemini to quickly draft system-wide announcements, maintenance notices, or marketing messages.
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Topic / Key Message</label>
                      <textarea
                        value={announceTopic}
                        onChange={(e) => setAnnounceTopic(e.target.value)}
                        placeholder="e.g., Scheduled maintenance on Saturday night from 10 PM to 2 AM..."
                        className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                      />
                    </div>
                    <div>
                      <Dropdown
                        label="Target Audience"
                        options={[
                          { value: 'All Users', label: 'All Users', color: 'bg-blue-500' },
                          { value: 'Students Only', label: 'Students Only', color: 'bg-green-500' },
                          { value: 'Instructors Only', label: 'Instructors Only', color: 'bg-amber-500' },
                          { value: 'Admins Only', label: 'Admins Only', color: 'bg-purple-500' }
                        ]}
                        value={announceAudience}
                        onChange={(val) => setAnnounceAudience(val)}
                        placeholder="Select audience"
                      />
                    </div>
                    <button
                      onClick={handleGenerateAI}
                      disabled={!announceTopic || isGenerating}
                      className={`w-full py-2.5 rounded-lg font-medium text-white flex items-center justify-center gap-2 transition-all ${!announceTopic || isGenerating
                        ? 'bg-emerald-300 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-md'
                        }`}
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Drafting...
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          Generate Draft
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Preview</span>
                      {generatedAnnouncement && (
                        <div className="flex gap-2">
                          <button
                            onClick={handleUseAnnouncement}
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-xs font-medium"
                          >
                            <Send size={14} />
                            Dùng cho Broadcast
                          </button>
                          <button
                            onClick={handleCopy}
                            className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-xs font-medium"
                          >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? 'Copied' : 'Copy Text'}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[400px]">
                      {generatedAnnouncement || (
                        <span className="text-gray-400 italic">
                          Your generated announcement will appear here...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;