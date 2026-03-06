import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import {
    Play,
    Square,
    Terminal as TerminalIcon,
    Zap,
    CheckCircle2,
    AlertCircle,
    Clock,
    ChevronRight,
    Database,
    History,
    Lock,
    ThumbsUp,
    ThumbsDown,
    Info
} from 'lucide-react';
import { toast } from 'sonner';

const LogEntry = ({ log }) => {
    const getLevelColor = (level) => {
        switch (level) {
            case 'error': return 'text-red-400';
            case 'warn': return 'text-amber-400';
            case 'success': return 'text-emerald-400';
            case 'step': return 'text-blue-400 font-bold';
            default: return 'text-gray-300';
        }
    };

    return (
        <div className="flex space-x-3 py-1 font-mono text-xs border-b border-white/[0.02] last:border-0">
            <span className="text-gray-600 flex-shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span className={`${getLevelColor(log.level)} uppercase text-[9px] w-12 flex-shrink-0`}>[{log.level}]</span>
            <span className="break-all">{log.message}</span>
        </div>
    );
};

const AutomationRunner = () => {
    const [activeTask, setActiveTask] = useState(null);
    const [logs, setLogs] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isExecuting, setIsExecuting] = useState(false);
    const terminalRef = useRef(null);

    const availableScripts = [
        { id: 'iebc_verification', name: 'IEBC Data Verification', icon: Database, desc: 'Cluster detection & geocoding audit' },
        { id: 'coord_correction', name: 'Coordinate Fixer', icon: Zap, desc: 'Automatic alignment from known benchmarks' },
        { id: 'geocode_sync', name: 'Nominatim Sync', icon: History, desc: 'Refresh OSM data associations' },
    ];

    useEffect(() => {
        fetchTasks();
        const subscription = supabase
            .channel('admin_tasks_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_tasks' }, () => fetchTasks())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_task_logs' }, (payload) => {
                if (activeTask && payload.new.task_id === activeTask.id) {
                    setLogs(prev => [...prev, payload.new]);
                    if (payload.new.level === 'step') toast.info(payload.new.message);
                    if (payload.new.level === 'success') toast.success(payload.new.message);
                    if (payload.new.level === 'error') toast.error(payload.new.message);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(subscription); };
    }, [activeTask]);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    const fetchTasks = async () => {
        const { data } = await (supabase as any)
            .from('admin_tasks')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
        setTasks(data || []);
        setLoading(false);
    };

    const startTask = async (scriptId) => {
        setIsExecuting(true);
        setLogs([]);
        try {
            // 1. Create task record
            const { data: task, error } = await (supabase as any)
                .from('admin_tasks')
                .insert({
                    task_type: scriptId,
                    status: 'pending',
                    params: { environment: 'production', trigger: 'admin_nexus' }
                })
                .select()
                .single();

            if (error) throw error;
            setActiveTask(task);
            toast.success(`Initialised ${scriptId} pipeline`);

            // 2. Trigger GitHub Action (Mocking for now, will implement actual trigger next)
            // For now, we simulate the "pending" state. 
            // In production, this would call a Supabase Edge Function that triggers GitHub
        } catch (err) {
            toast.error(`Execution failed: ${err.message}`);
            setIsExecuting(false);
        }
    };

    const handleApproval = async (approved) => {
        if (!activeTask) return;
        try {
            await (supabase as any)
                .from('admin_tasks')
                .update({
                    status: approved ? 'running' : 'completed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', activeTask.id);

            toast.success(approved ? 'Changes approved. Resuming execution...' : 'Changes discarded.');
        } catch (err) {
            toast.error('Approval failed');
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-[calc(100vh-180px)]">
            {/* Left: Script Selection & Controls */}
            <div className="xl:col-span-4 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                        <Zap className="text-blue-400" size={20} />
                        <span>Automation Cells</span>
                    </h3>

                    <div className="space-y-3">
                        {availableScripts.map((script) => (
                            <button
                                key={script.id}
                                onClick={() => startTask(script.id)}
                                disabled={isExecuting}
                                className="w-full text-left p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-blue-500/40 hover:bg-blue-600/5 transition-all group disabled:opacity-50"
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 rounded-xl bg-white/5 group-hover:bg-blue-600/20 text-gray-400 group-hover:text-blue-400 transition-colors">
                                            <script.icon size={18} />
                                        </div>
                                        <span className="font-bold text-gray-200 group-hover:text-white">{script.name}</span>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-600 group-hover:text-blue-400" />
                                </div>
                                <p className="text-xs text-gray-500 ml-11">{script.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recent History */}
                <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8">
                    <h4 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-6 flex items-center space-x-2">
                        <History size={16} />
                        <span>Task History</span>
                    </h4>
                    <div className="space-y-4">
                        {tasks.map((t) => (
                            <div key={t.id} className="flex items-center justify-between p-2">
                                <div className="flex items-center space-x-3">
                                    <div className={`p-1.5 rounded-lg ${t.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                        t.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                            'bg-blue-500/20 text-blue-400'
                                        }`}>
                                        {t.status === 'completed' ? <CheckCircle2 size={12} /> :
                                            t.status === 'failed' ? <AlertCircle size={12} /> :
                                                <Clock size={12} className="animate-pulse" />}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-bold text-gray-300 truncate w-32">{t.task_type}</p>
                                        <p className="text-[10px] text-gray-600">{new Date(t.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-black uppercase text-gray-500">{t.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right: Real-time Terminal & HITL UI */}
            <div className="xl:col-span-8 flex flex-col space-y-6">
                {/* Terminal Window */}
                <div className="flex-1 bg-[#0a0c10] border border-white/10 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl">
                    <div className="bg-white/5 px-6 py-4 flex justify-between items-center border-b border-white/5">
                        <div className="flex items-center space-x-3">
                            <div className="flex space-x-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-l border-white/10 pl-3">
                                Live Output Stream
                            </span>
                        </div>
                        {activeTask && (
                            <div className="flex items-center space-x-2">
                                <span className="text-[10px] font-mono text-blue-400/60 uppercase">{activeTask.id.split('-')[0]}</span>
                                <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                            </div>
                        )}
                    </div>

                    <div
                        ref={terminalRef}
                        className="flex-1 p-6 font-mono overflow-y-auto custom-scrollbar bg-[#050608]/50"
                    >
                        {logs.length > 0 ? (
                            logs.map((log, i) => <LogEntry key={i} log={log} />)
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                                <TerminalIcon size={64} />
                                <p className="text-sm font-medium">Awaiting cell activation...</p>
                            </div>
                        )}
                    </div>

                    {/* HITL Intervention Overlay */}
                    <AnimatePresence>
                        {activeTask?.status === 'awaiting_approval' && (
                            <motion.div
                                initial={{ y: 100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 100, opacity: 0 }}
                                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-blue-600 border border-blue-400 rounded-3xl p-6 shadow-2xl z-20 flex items-center justify-between"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="p-3 bg-white/20 rounded-2xl">
                                        <Lock className="text-white" size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-white uppercase tracking-tight">Human intervention required</h4>
                                        <p className="text-blue-100 text-sm">Review 12 proposed coordinate overrides before proceeding.</p>
                                    </div>
                                </div>

                                <div className="flex space-x-3">
                                    <button
                                        onClick={() => handleApproval(false)}
                                        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold transition-all flex items-center space-x-2"
                                    >
                                        <ThumbsDown size={18} />
                                        <span>Discard</span>
                                    </button>
                                    <button
                                        onClick={() => handleApproval(true)}
                                        className="px-8 py-3 bg-white text-blue-600 hover:bg-gray-100 rounded-2xl font-black shadow-xl transition-all flex items-center space-x-2"
                                    >
                                        <ThumbsUp size={18} />
                                        <span>Approve changes</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Quick Help Card */}
                <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-[2rem] flex items-center space-x-4">
                    <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-400">
                        <Info size={24} />
                    </div>
                    <div>
                        <h5 className="text-sm font-bold text-amber-300 tracking-tight">Execution Safety Protocol</h5>
                        <p className="text-[11px] text-amber-400/60 leading-relaxed uppercase tracking-wider font-black">
                            Production scripts are gated by HITL. No writes occur without human validation of the proposed diff.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutomationRunner;
