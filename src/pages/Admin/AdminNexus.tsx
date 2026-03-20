import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import AdminSidebar from '@/components/Admin/AdminSidebar';
import AdminVerification from './AdminVerification';

// Lazy load tabs to keep initial bundle light
const InsightsOverview = React.lazy(() => import('@/components/Admin/tabs/InsightsOverview'));
const ModerationPanel = React.lazy(() => import('@/components/Admin/tabs/ModerationPanel'));
const AutomationRunner = React.lazy(() => import('@/components/Admin/tabs/AutomationRunner'));
const DataRegistry = React.lazy(() => import('@/components/Admin/tabs/DataRegistry'));
const HITLModeration = React.lazy(() => import('@/components/Admin/tabs/HITLModeration'));
const SystemAnalytics = React.lazy(() => import('@/components/Admin/tabs/SystemAnalytics'));
const SecurityAudit = React.lazy(() => import('@/components/Admin/tabs/SecurityAudit'));

const AdminNexus = () => {
    const [isVerified, setIsVerified] = useState(false);
    const [activeTab, setActiveTab] = useState('insights');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    if (!isVerified) {
        return <AdminVerification onVerified={() => setIsVerified(true)} />;
    }

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'insights': return <InsightsOverview onTabChange={setActiveTab} />;
            case 'moderation': return <ModerationPanel />;
            case 'hitl': return <HITLModeration />;
            case 'automation': return <AutomationRunner />;
            case 'registry': return <DataRegistry />;
            case 'analytics': return <SystemAnalytics />;
            case 'security': return <SecurityAudit />;
            default: return (
                <div className="p-12 text-center border-2 border-dashed border-white/10 rounded-3xl">
                    <p className="text-gray-500">Requested admin access <span className="text-blue-400 font-mono">[{activeTab}]</span> is currently offline or unlinked.</p>
                </div>
            );
        }
    };

    return (
        <div className="min-h-screen bg-[#050608] text-white flex overflow-hidden font-sans">
            <AdminSidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                onLogout={() => {
                    supabase.auth.signOut();
                    window.location.reload();
                }}
            />

            <main className={`flex-1 relative transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ml-[260px]' : 'ml-[88px]'} h-screen overflow-y-auto`}>
                {/* Dynamic Header */}
                <header className="sticky top-0 z-40 px-8 py-6 flex justify-between items-center bg-[#050608]/60 backdrop-blur-xl border-b border-white/5">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-white capitalize">
                            {activeTab}
                        </h2>
                        <p className="text-sm text-gray-400">System Governance & Operations</p>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="flex flex-col items-end mr-4">
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Nasaka Admin</span>
                            <span className="text-[10px] text-gray-500 font-medium">by CEKA</span>
                        </div>
                        <div className="h-10 w-10 rounded-full border border-white/10 p-0.5">
                            <div className="w-full h-full rounded-full bg-[#007AFF] flex items-center justify-center text-xs font-bold">
                                AD
                            </div>
                        </div>
                    </div>
                </header>

                {/* Tab Content with AnimatePresence */}
                <div className="p-8 pb-32">
                    <React.Suspense fallback={
                        <div className="h-[60vh] flex items-center justify-center">
                            <div className="flex flex-col items-center space-y-4">
                                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                                <p className="text-sm text-blue-400/60 font-medium uppercase tracking-widest">Initialising Admin Access...</p>
                            </div>
                        </div>
                    }>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10, scale: 0.99 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.99 }}
                                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                            >
                                {renderActiveTab()}
                            </motion.div>
                        </AnimatePresence>
                    </React.Suspense>
                </div>
            </main>
        </div>
    );
};

export default AdminNexus;
