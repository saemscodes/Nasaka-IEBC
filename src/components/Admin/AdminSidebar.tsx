import React from 'react';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    CheckCircle2,
    Terminal,
    Table,
    LineChart,
    ShieldCheck,
    LogOut,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, isActive, onClick, isOpen }) => (
    <motion.button
        whileHover={{ x: 4, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`w-full flex items-center px-4 py-3 rounded-2xl transition-all duration-300 group relative ${isActive
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
    >
        <div className={`flex items-center justify-center p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-blue-600/20' : 'bg-transparent'
            }`}>
            <Icon size={20} className={isActive ? 'text-blue-400' : 'group-hover:text-white'} />
        </div>

        <motion.span
            initial={false}
            animate={{
                opacity: isOpen ? 1 : 0,
                x: isOpen ? 12 : -20,
                display: isOpen ? 'block' : 'none'
            }}
            className="font-medium whitespace-nowrap"
        >
            {label}
        </motion.span>

        {!isOpen && (
            <div className="absolute left-full ml-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {label}
            </div>
        )}

        {isActive && (
            <motion.div
                layoutId="activeIndicator"
                className="absolute left-0 w-1 h-6 bg-blue-500 rounded-r-full"
            />
        )}
    </motion.button>
);

const AdminSidebar = ({ activeTab, onTabChange, onLogout, isOpen, toggleSidebar }) => {
    const menuItems = [
        { id: 'insights', label: 'Insights', icon: LayoutDashboard },
        { id: 'moderation', label: 'Moderation', icon: CheckCircle2 },
        { id: 'automation', label: 'Automation', icon: Terminal },
        { id: 'registry', label: 'Registry', icon: Table },
        { id: 'analytics', label: 'Analytics', icon: LineChart },
        { id: 'security', label: 'Security', icon: ShieldCheck },
    ];

    return (
        <motion.aside
            initial={false}
            animate={{ width: isOpen ? 260 : 88 }}
            className={`fixed left-0 top-0 h-screen bg-[#0a0c10]/80 backdrop-blur-2xl border-r border-white/5 z-50 flex flex-col p-4 overflow-hidden transition-all duration-300 ease-in-out`}
        >
            {/* Brand Header */}
            <div className="mb-10 flex items-center h-12 px-2">
                <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                    <ShieldCheck className="text-white" size={24} />
                </div>
                <motion.div
                    animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 12 : -10 }}
                    className="overflow-hidden"
                >
                    <h1 className="font-black text-xl text-white tracking-tight">ADMIN</h1>
                    <p className="text-[10px] text-blue-400/60 uppercase tracking-widest font-black leading-none">Nexus Grid</p>
                </motion.div>
            </div>

            {/* Menu Sections */}
            <div className="flex-1 space-y-2">
                {menuItems.map((item) => (
                    <SidebarItem
                        key={item.id}
                        {...item}
                        isActive={activeTab === item.id}
                        onClick={() => onTabChange(item.id)}
                        isOpen={isOpen}
                    />
                ))}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-white/5 space-y-2">
                <button
                    onClick={toggleSidebar}
                    className="w-full flex items-center px-4 py-3 rounded-2xl text-gray-400 hover:text-white hover:bg-white/5 transition-all group"
                >
                    <div className="flex items-center justify-center p-2 rounded-xl bg-transparent group-hover:bg-white/5">
                        {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                    </div>
                    <motion.span
                        animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 12 : -10 }}
                        className={`font-medium ${!isOpen && 'hidden'}`}
                    >
                        Collapse
                    </motion.span>
                </button>

                <SidebarItem
                    icon={LogOut}
                    label="Logout"
                    onClick={onLogout}
                    isOpen={isOpen}
                    isActive={false}
                />
            </div>
        </motion.aside>
    );
};

export default AdminSidebar;
