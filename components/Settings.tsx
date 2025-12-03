import React, { useState } from 'react';
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
  Smartphone,
  Copy,
  Check
} from 'lucide-react';
import { generateSystemAnnouncement } from '../services/geminiService';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'security' | 'announcements'>('general');
  const [isSaved, setIsSaved] = useState(false);

  // AI State
  const [announceTopic, setAnnounceTopic] = useState('');
  const [announceAudience, setAnnounceAudience] = useState('All Users');
  const [generatedAnnouncement, setGeneratedAnnouncement] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mock Settings State
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

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
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

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'announcements', label: 'Announcements (AI)', icon: Megaphone },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-500 mt-1">Manage platform preferences and system configuration</p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white transition-all shadow-sm font-medium ${isSaved ? 'bg-green-600' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
        >
          {isSaved ? <Check size={18} /> : <Save size={18} />}
          {isSaved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-64 shrink-0">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Enter platform name"
                    />
                  </div>
                  <div>
                    <label htmlFor="support-email" className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
                    <input
                      id="support-email"
                      type="email"
                      value={settings.supportEmail}
                      onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Enter support email"
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

                  <div className="flex items-center justify-between py-3 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Smartphone size={20} /></div>
                      <div>
                        <p className="font-medium text-gray-900">Push Notifications</p>
                        <p className="text-xs text-gray-500">Mobile app alerts</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggle('pushNotifs')}
                      className={`text-2xl transition-colors ${settings.pushNotifs ? 'text-emerald-600' : 'text-gray-300'}`}
                    >
                      {settings.pushNotifs ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
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
                    <label htmlFor="session-timeout" className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (minutes)</label>
                    <select
                      id="session-timeout"
                      value={settings.sessionTimeout}
                      onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                      title="Select session timeout duration"
                    >
                      <option value="15">15 Minutes</option>
                      <option value="30">30 Minutes</option>
                      <option value="60">1 Hour</option>
                      <option value="120">2 Hours</option>
                    </select>
                  </div>
                  <div className="pt-4">
                    <button className="text-red-600 text-sm font-medium hover:text-red-700 hover:underline">
                      Reset all sessions
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
                      <label htmlFor="target-audience" className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                      <select
                        id="target-audience"
                        value={announceAudience}
                        onChange={(e) => setAnnounceAudience(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                        title="Select target audience"
                      >
                        <option>All Users</option>
                        <option>Students Only</option>
                        <option>Instructors Only</option>
                        <option>Admins Only</option>
                      </select>
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
                        <button
                          onClick={handleCopy}
                          className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-xs font-medium"
                        >
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                          {copied ? 'Copied' : 'Copy Text'}
                        </button>
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