import React from 'react';
import { Settings, AlertTriangle, Clock } from 'lucide-react';

interface MaintenancePageProps {
    siteName?: string;
}

const MaintenancePage: React.FC<MaintenancePageProps> = ({ siteName = 'Blanc' }) => {
    return (
        <div className="min-h-screen bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
                {/* Animated Icon */}
                <div className="relative mb-8">
                    <div className="w-24 h-24 mx-auto bg-linear-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                        <Settings className="w-12 h-12 text-white animate-spin-slow" style={{ animationDuration: '3s' }} />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-bounce">
                        <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-4xl font-bold text-white mb-4">
                    Đang Bảo Trì
                </h1>

                {/* Subtitle */}
                <p className="text-xl text-gray-300 mb-6">
                    {siteName} đang được nâng cấp để phục vụ bạn tốt hơn
                </p>

                {/* Description */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 mb-8 border border-gray-700">
                    <p className="text-gray-400 leading-relaxed">
                        Chúng tôi đang thực hiện một số cải tiến quan trọng.
                        Hệ thống sẽ trở lại hoạt động trong thời gian sớm nhất.
                    </p>
                </div>

                {/* Status */}
                <div className="flex items-center justify-center gap-2 text-amber-400">
                    <Clock className="w-5 h-5 animate-pulse" />
                    <span className="text-sm font-medium">Vui lòng quay lại sau</span>
                </div>

                {/* Refresh Button */}
                <button
                    onClick={() => window.location.reload()}
                    className="mt-8 px-6 py-3 bg-linear-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all transform hover:scale-105 shadow-lg"
                >
                    Kiểm tra lại
                </button>

                {/* Footer */}
                <p className="mt-8 text-gray-500 text-sm">
                    Cảm ơn bạn đã kiên nhẫn chờ đợi! 💚
                </p>
            </div>

            {/* Background decoration */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
            </div>
        </div>
    );
};

export default MaintenancePage;
