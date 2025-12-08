import React, { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
    ChevronRight,
    ChevronLeft,
    Bot,
    Sparkles,
    Bold,
    Italic,
    List,
    ListTree,
    Wand2,
    Download,
    Mail,
    Undo,
    Redo,
    Minus,
    Plus,
    Maximize2,
    Minimize2,
    Send,
    Save,
    Loader2,
    PanelLeftClose,
    PanelLeft,
    FileText,
    FileType,
    ChevronDown,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify
} from 'lucide-react';
import { Report, ChatMessage } from '../types';
import { chatWithReportAgent, generateReportContent } from '../services/geminiService';
import reportService from '../services/reportService';

interface ReportEditorProps {
    report: Report | null;
    onBack: () => void;
    onOpenEmail?: (content: string) => void;
    isFullScreen?: boolean;
    onToggleFullScreen?: () => void;
    onReportUpdate?: (report: Report) => void;
}

export const ReportEditor: React.FC<ReportEditorProps> = ({
    report,
    onBack,
    onOpenEmail,
    isFullScreen = false,
    onToggleFullScreen,
    onReportUpdate
}) => {
    // Initialize content with HTML or fallback
    const [content, setContent] = useState(report?.content || "<h1>Báo cáo mới</h1><p>Bắt đầu viết tại đây...</p>");
    const [isAgentOpen, setIsAgentOpen] = useState(true);
    const [isOutlineOpen, setIsOutlineOpen] = useState(true);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: '1', role: 'model', text: 'Xin chào! Tôi đã tải mẫu báo cáo của bạn. Tôi có thể giúp bạn soạn nội dung, tóm tắt các phần, hoặc chỉnh sửa văn phong. Hãy hỏi tôi!', timestamp: new Date() }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [zoom, setZoom] = useState(100);

    // Auto-save states
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [prevFullScreen, setPrevFullScreen] = useState(isFullScreen);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Formatting states
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isList, setIsList] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Close export menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Check formatting state on selection change
    const updateFormattingState = useCallback(() => {
        setIsBold(document.queryCommandState('bold'));
        setIsItalic(document.queryCommandState('italic'));
        setIsList(document.queryCommandState('insertUnorderedList'));
    }, []);

    useEffect(() => {
        const handleSelectionChange = () => {
            updateFormattingState();
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [updateFormattingState]);

    // Track fullscreen changes for animation
    useEffect(() => {
        if (isFullScreen !== prevFullScreen) {
            setIsAnimating(true);
            setPrevFullScreen(isFullScreen);
            const timer = setTimeout(() => setIsAnimating(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isFullScreen, prevFullScreen]);

    // Sync content state to editorRef when report changes (initial load)
    useEffect(() => {
        if (editorRef.current && report?.content) {
            if (editorRef.current.innerHTML !== report.content) {
                editorRef.current.innerHTML = report.content;
                setContent(report.content);
            }
        }
    }, [report?.id]);

    // Auto-save function
    const saveReport = useCallback(async (contentToSave: string) => {
        if (!report?.id || report.id.startsWith('new-')) {
            // Skip auto-save for new unsaved reports
            return;
        }

        try {
            setIsSaving(true);
            const updated = await reportService.update(report.id, { content: contentToSave });
            setLastSaved(new Date());
            setHasUnsavedChanges(false);
            if (onReportUpdate) {
                onReportUpdate(updated);
            }
        } catch (err) {
            console.error('Error auto-saving report:', err);
            toast.error('Lỗi khi lưu báo cáo');
        } finally {
            setIsSaving(false);
        }
    }, [report?.id, onReportUpdate]);

    // Debounced auto-save on content change
    const handleContentChange = useCallback(() => {
        const newContent = editorRef.current?.innerHTML || '';
        setContent(newContent);
        setHasUnsavedChanges(true);

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Set new timeout for auto-save (2 seconds debounce)
        saveTimeoutRef.current = setTimeout(() => {
            saveReport(newContent);
        }, 2000);
    }, [saveReport]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Manual save function
    const handleManualSave = async () => {
        const currentContent = editorRef.current?.innerHTML || '';
        await saveReport(currentContent);
    };

    // Generate clean filename
    const getCleanFilename = (title: string) => {
        return title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s]/g, '').replace(/\s+/g, '_') || 'Bao_cao';
    };

    // Export as PDF (using print dialog)
    const handleExportPDF = () => {
        setShowExportMenu(false);
        const htmlContent = editorRef.current?.innerHTML || '';
        const title = report?.title || 'Báo cáo';

        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Vui lòng cho phép popup để xuất PDF');
            return;
        }

        printWindow.document.write(`
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        @page {
            size: A4;
            margin: 2cm;
        }
        body {
            font-family: 'Times New Roman', Georgia, serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
            max-width: 100%;
        }
        h1 { font-size: 18pt; margin-bottom: 12pt; }
        h2 { font-size: 16pt; margin-bottom: 10pt; }
        h3 { font-size: 14pt; margin-bottom: 8pt; }
        p { margin-bottom: 10pt; text-align: justify; }
        ul, ol { margin-bottom: 10pt; padding-left: 20pt; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; }
        th, td { border: 1px solid #000; padding: 6pt; }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`);
        printWindow.document.close();

        // Wait for content to load then print
        printWindow.onload = () => {
            printWindow.print();
            // Close window after print dialog closes (optional)
            printWindow.onafterprint = () => printWindow.close();
        };

        toast.success('Đang mở hộp thoại in PDF...');
    };

    // Export as Word (DOCX using HTML conversion)
    const handleExportWord = () => {
        setShowExportMenu(false);
        const htmlContent = editorRef.current?.innerHTML || '';
        const title = report?.title || 'Báo cáo';
        const filename = getCleanFilename(title);

        // Create Word-compatible HTML
        const wordHtml = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <title>${title}</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page {
            size: A4;
            margin: 2.5cm 2cm;
        }
        body {
            font-family: 'Times New Roman', serif;
            font-size: 13pt;
            line-height: 1.5;
            color: #000;
        }
        h1 { font-size: 18pt; font-weight: bold; margin-bottom: 12pt; color: #000; }
        h2 { font-size: 16pt; font-weight: bold; margin-bottom: 10pt; color: #000; }
        h3 { font-size: 14pt; font-weight: bold; margin-bottom: 8pt; color: #000; }
        p { margin-bottom: 10pt; text-align: justify; }
        ul, ol { margin-bottom: 10pt; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
        th, td { border: 1px solid #000; padding: 8pt; }
        th { background-color: #f0f0f0; font-weight: bold; }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

        const blob = new Blob(['\ufeff' + wordHtml], {
            type: 'application/msword;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Đã xuất file Word thành công!');
    };

    // Export as HTML
    const handleExportHTML = () => {
        setShowExportMenu(false);
        const htmlContent = editorRef.current?.innerHTML || '';
        const title = report?.title || 'Báo cáo';
        const filename = getCleanFilename(title);

        const fullHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Times New Roman', Georgia, serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            line-height: 1.6;
            color: #1e293b;
        }
        h1, h2, h3 { color: #0f172a; margin-top: 1.5em; }
        h1 { font-size: 1.75em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.25em; }
        p { margin-bottom: 1em; text-align: justify; }
        ul, ol { margin-bottom: 1em; padding-left: 2em; }
        table { width: 100%; border-collapse: collapse; margin: 1em 0; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 12px; }
        th { background-color: #f1f5f9; }
        @media print {
            body { padding: 20px; max-width: 100%; }
        }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Đã xuất file HTML thành công!');
    };

    // Format last saved time
    const getLastSavedText = () => {
        if (isSaving) return 'Đang lưu...';
        if (!lastSaved) return 'Đã lưu vừa xong';

        const now = new Date();
        const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

        if (diff < 60) return 'Đã lưu vừa xong';
        if (diff < 3600) return `Đã lưu ${Math.floor(diff / 60)} phút trước`;
        return `Đã lưu ${Math.floor(diff / 3600)} giờ trước`;
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: inputValue, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        // AI Logic Integration
        const history = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

        const responseText = await chatWithReportAgent(history, userMsg.text);

        setIsTyping(false);
        const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: responseText,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMsg]);
    };

    const handleQuickAction = async (action: string) => {
        setIsTyping(true);
        let prompt = "";
        const currentTextContext = editorRef.current?.innerText || "";

        if (action === 'summarize') prompt = "Tóm tắt ngắn gọn nội dung báo cáo hiện tại.";
        if (action === 'polish') prompt = "Viết lại nội dung báo cáo với văn phong chuyên nghiệp và trang trọng hơn.";
        if (action === 'expand') prompt = "Mở rộng và phát triển các điểm chính của báo cáo với nhiều chi tiết hơn.";

        const response = await generateReportContent(prompt, currentTextContext.substring(0, 2000));
        setIsTyping(false);

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            text: `Đây là gợi ý:\n\n${response}`,
            timestamp: new Date()
        }]);
    };

    const execCmd = (command: string, value: string | undefined = undefined) => {
        // Ensure the editor is focused before executing command
        if (editorRef.current) {
            // Focus the editor first
            editorRef.current.focus();

            // Execute command immediately
            try {
                document.execCommand(command, false, value);
                // Update formatting state
                updateFormattingState();
                // Trigger content change for auto-save
                handleContentChange();
            } catch (error) {
                console.error('Error executing command:', command, error);
            }
        }
    };

    const adjustZoom = (amount: number) => {
        setZoom(prev => Math.min(Math.max(prev + amount, 50), 200));
    };

    // Determine animation class
    const getAnimationClass = () => {
        if (!isAnimating) return '';
        return isFullScreen ? 'animate-expand-fullscreen' : 'animate-collapse-fullscreen';
    };

    return (
        <div className={`flex flex-col h-full overflow-hidden bg-slate-100 relative fullscreen-container ${isFullScreen ? 'fullscreen-active' : ''} ${getAnimationClass()}`}>

            {/* Backdrop overlay for fullscreen */}
            {isFullScreen && (
                <div className="fixed inset-0 bg-black/20 -z-10" />
            )}

            {/* Editor Toolbar */}
            <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm relative transition-all duration-300">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors" title="Quay lại" aria-label="Quay lại">
                        <ChevronRight className="w-5 h-5 rotate-180" />
                    </button>
                    <div>
                        <h2 className="font-semibold text-slate-800 text-sm md:text-base">{report?.title || 'Báo cáo mới'}</h2>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{report?.template || 'Chung'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                                {hasUnsavedChanges && !isSaving && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>}
                                {getLastSavedText()}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    {/* WYSIWYG Toolbar */}
                    <div className="hidden lg:flex items-center gap-1 bg-slate-50 p-1 rounded-lg mr-2 border border-slate-200">
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execCmd('bold')}
                            className={`p-1.5 hover:bg-white hover:shadow-sm rounded transition-all ${isBold ? 'bg-blue-100 text-blue-600 shadow-sm' : 'text-slate-600'}`}
                            title="Đậm (Ctrl+B)"
                        >
                            <Bold className="w-4 h-4" />
                        </button>
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execCmd('italic')}
                            className={`p-1.5 hover:bg-white hover:shadow-sm rounded transition-all ${isItalic ? 'bg-blue-100 text-blue-600 shadow-sm' : 'text-slate-600'}`}
                            title="Nghiêng (Ctrl+I)"
                        >
                            <Italic className="w-4 h-4" />
                        </button>
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execCmd('insertUnorderedList')}
                            className={`p-1.5 hover:bg-white hover:shadow-sm rounded transition-all ${isList ? 'bg-blue-100 text-blue-600 shadow-sm' : 'text-slate-600'}`}
                            title="Danh sách"
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execCmd('justifyLeft')}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded text-slate-600 transition-all"
                            title="Canh trái"
                        >
                            <AlignLeft className="w-4 h-4" />
                        </button>
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execCmd('justifyCenter')}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded text-slate-600 transition-all"
                            title="Canh giữa"
                        >
                            <AlignCenter className="w-4 h-4" />
                        </button>
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execCmd('justifyRight')}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded text-slate-600 transition-all"
                            title="Canh phải"
                        >
                            <AlignRight className="w-4 h-4" />
                        </button>
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execCmd('justifyFull')}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded text-slate-600 transition-all"
                            title="Canh đều"
                        >
                            <AlignJustify className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execCmd('undo')}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded text-slate-600 transition-all"
                            title="Hoàn tác (Ctrl+Z)"
                        >
                            <Undo className="w-4 h-4" />
                        </button>
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execCmd('redo')}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded text-slate-600 transition-all"
                            title="Làm lại (Ctrl+Y)"
                        >
                            <Redo className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Zoom Controls */}
                    <div className="hidden sm:flex items-center gap-1 bg-slate-50 p-1 rounded-lg mr-2 border border-slate-200">
                        <button onClick={() => adjustZoom(-10)} className="p-1.5 hover:bg-white hover:shadow-sm rounded text-slate-600 transition-all" title="Thu nhỏ"><Minus className="w-3 h-3" /></button>
                        <span className="text-xs font-medium w-10 text-center text-slate-600 select-none">{zoom}%</span>
                        <button onClick={() => adjustZoom(10)} className="p-1.5 hover:bg-white hover:shadow-sm rounded text-slate-600 transition-all" title="Phóng to"><Plus className="w-3 h-3" /></button>
                    </div>

                    {/* Full Screen Toggle */}
                    <button
                        onClick={onToggleFullScreen}
                        className={`p-2 rounded-lg transition-colors border shadow-sm hidden sm:block ${isFullScreen
                            ? 'bg-blue-50 border-blue-200 text-blue-600'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                            }`}
                        title={isFullScreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                    >
                        {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>

                    <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

                    {/* Export Dropdown */}
                    <div className="relative" ref={exportMenuRef}>
                        <button
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="hidden sm:flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                            title="Xuất báo cáo"
                            aria-label="Xuất báo cáo"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden xl:inline">Xuất file</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>

                        {/* Dropdown Menu */}
                        {showExportMenu && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 animate-fade-in">
                                <button
                                    onClick={handleExportPDF}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <FileText className="w-4 h-4 text-red-500" />
                                    <div className="text-left">
                                        <div className="font-medium">Xuất PDF</div>
                                        <div className="text-xs text-slate-400">In hoặc lưu PDF</div>
                                    </div>
                                </button>
                                <button
                                    onClick={handleExportWord}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <FileType className="w-4 h-4 text-blue-500" />
                                    <div className="text-left">
                                        <div className="font-medium">Xuất Word</div>
                                        <div className="text-xs text-slate-400">File .doc</div>
                                    </div>
                                </button>
                                <div className="border-t border-slate-100 my-1"></div>
                                <button
                                    onClick={handleExportHTML}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <Download className="w-4 h-4 text-slate-500" />
                                    <div className="text-left">
                                        <div className="font-medium">Xuất HTML</div>
                                        <div className="text-xs text-slate-400">Trang web</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    {onOpenEmail && (
                        <button
                            onClick={() => onOpenEmail(editorRef.current?.innerText || "")}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                            title="Tạo email từ báo cáo"
                            aria-label="Tạo email từ báo cáo"
                        >
                            <Mail className="w-4 h-4" />
                            <span className="hidden md:inline">Tạo Email</span>
                        </button>
                    )}

                    <button
                        onClick={() => setIsAgentOpen(!isAgentOpen)}
                        className={`p-2 rounded-lg transition-colors border shadow-sm ${isAgentOpen ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'}`}
                        title={isAgentOpen ? "Đóng trợ lý AI" : "Mở trợ lý AI"}
                        aria-label={isAgentOpen ? "Đóng trợ lý AI" : "Mở trợ lý AI"}
                    >
                        <Bot className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">

                {/* Document Structure (Outline) - Fixed position, always visible on lg+ */}
                <div className={`hidden lg:flex flex-col bg-slate-50 border-r border-slate-200 overflow-hidden transition-all duration-300 shrink-0 ${isOutlineOpen ? 'w-64' : 'w-14'}`}>
                    {/* Toggle Button */}
                    <button
                        onClick={() => setIsOutlineOpen(!isOutlineOpen)}
                        className="flex items-center justify-center w-full h-12 hover:bg-slate-100 transition-colors border-b border-slate-200 cursor-pointer"
                        title={isOutlineOpen ? "Thu gọn cấu trúc" : "Mở rộng cấu trúc"}
                        type="button"
                    >
                        {isOutlineOpen ? (
                            <PanelLeftClose className="w-5 h-5 text-slate-500" />
                        ) : (
                            <ListTree className="w-5 h-5 text-slate-500" />
                        )}
                    </button>

                    {/* Content */}
                    <div className={`flex-1 overflow-y-auto transition-opacity duration-200 ${isOutlineOpen ? 'opacity-100 p-6' : 'opacity-0 p-0 pointer-events-none'}`}>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Cấu trúc</h3>
                        <div className="text-sm text-slate-500 italic">
                            Cấu trúc được tạo từ các tiêu đề. Thêm H1, H2, hoặc H3 để hiển thị tại đây.
                        </div>
                        <ul className="mt-4 space-y-2 text-sm text-slate-600">
                            <li className="pl-0 font-medium text-blue-600">Tiêu đề báo cáo</li>
                            <li className="pl-3">Giới thiệu</li>
                            <li className="pl-3">Nội dung chính</li>
                            <li className="pl-3">Kết luận</li>
                        </ul>
                    </div>
                </div>

                {/* Main Editing Area - WYSIWYG */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100 flex justify-center relative scroll-smooth min-w-0">
                    {/* eslint-disable-next-line react/forbid-dom-props */}
                    <div
                        className="relative transition-transform duration-200 ease-out origin-top w-[850px] h-max mb-[500px]"
                        style={{ transform: `scale(${zoom / 100})` }}
                    >
                        <div className="w-full bg-white shadow-lg border border-slate-200 min-h-[1100px] relative print:shadow-none print:border-none">
                            {/* A4 Paper Simulation */}
                            <div
                                ref={editorRef}
                                className="w-full h-full p-16 outline-none prose prose-slate max-w-none bg-white min-h-[1123px]"
                                contentEditable
                                suppressContentEditableWarning
                                onInput={handleContentChange}
                            >
                                {/* Content injected via ref/useEffect initially */}
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Agent Panel */}
                {isAgentOpen && (
                    <div className="w-80 md:w-96 bg-white border-l border-slate-200 flex flex-col shadow-2xl absolute md:relative right-0 h-full z-20 animate-fade-in">
                        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                <Sparkles className="w-4 h-4 text-teal-500" />
                                Trợ lý AI
                            </div>
                            <button onClick={() => setIsAgentOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600" title="Đóng" aria-label="Đóng">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-none'
                                        : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
                                        } whitespace-pre-wrap`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex gap-1">
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Quick Chips */}
                        <div className="px-4 py-3 flex flex-wrap gap-2 border-t border-slate-100 bg-white">
                            <button onClick={() => handleQuickAction('summarize')} className="text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 border border-transparent hover:border-blue-200">
                                <Wand2 className="w-3 h-3" /> Tóm tắt
                            </button>
                            <button onClick={() => handleQuickAction('polish')} className="text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 px-3 py-1.5 rounded-full transition-colors border border-transparent hover:border-blue-200">
                                Văn phong trang trọng
                            </button>
                            <button onClick={() => handleQuickAction('expand')} className="text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 px-3 py-1.5 rounded-full transition-colors border border-transparent hover:border-blue-200">
                                Mở rộng
                            </button>
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-slate-200 bg-white">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Nhờ trợ lý viết hoặc chỉnh sửa..."
                                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-sm transition-shadow"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim()}
                                    className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:bg-slate-300 hover:bg-blue-700 transition-all shadow-sm"
                                    title="Gửi"
                                    aria-label="Gửi"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportEditor;
