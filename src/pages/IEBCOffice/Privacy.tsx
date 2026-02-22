import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowLeft, Shield, Scale, Database, Lock, Users, FileText, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';

const Privacy = () => {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ 'data-mission': true });

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };

    const sectionVariants = {
        collapsed: { height: 0, opacity: 0, marginTop: 0 },
        expanded: { height: 'auto', opacity: 1, marginTop: 16 }
    };

    const CollapsibleSection = ({ id, title, icon: Icon, children, defaultExpanded = false }: any) => {
        const isExpanded = expandedSections[id] ?? defaultExpanded;

        return (
            <motion.div
                layout
                className={`mb-4 overflow-hidden rounded-2xl border transition-all duration-300 ${theme === 'dark'
                        ? 'bg-[#1C1C1E]/40 border-[#38383A] hover:bg-[#1C1C1E]/60'
                        : 'bg-white/40 border-[#D8D8DC] hover:bg-white/60'
                    } backdrop-blur-xl`}
            >
                <button
                    onClick={() => toggleSection(id)}
                    className="w-full flex items-center justify-between p-5 text-left"
                >
                    <div className="flex items-center space-x-4">
                        <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50/80 text-blue-600'
                            }`}>
                            <Icon size={20} strokeWidth={2.5} />
                        </div>
                        <h2 className={`text-lg font-semibold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]'}`}>
                            {title}
                        </h2>
                    </div>
                    <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className={theme === 'dark' ? 'text-ios-gray-400' : 'text-ios-gray-500'}
                    >
                        <ChevronDown size={20} />
                    </motion.div>
                </button>

                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            initial="collapsed"
                            animate="expanded"
                            exit="collapsed"
                            variants={sectionVariants}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        >
                            <div className={`px-5 pb-6 text-[15px] leading-relaxed ${theme === 'dark' ? 'text-ios-gray-200' : 'text-ios-gray-600'}`}>
                                <div className={`h-px w-full mb-5 ${theme === 'dark' ? 'bg-[#38383A]' : 'bg-[#D8D8DC]'}`} />
                                {children}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    };

    return (
        <div className={`min-h-screen ${theme === 'dark' ? 'bg-black' : 'bg-[#F2F2F7]'}`}>
            {/* iOS Status Bar Spacer */}
            <div className="h-[env(safe-area-inset-top,0px)]" />

            {/* Premium Header */}
            <div className={`sticky top-0 z-50 backdrop-blur-2xl border-b px-6 py-4 flex items-center justify-between ${theme === 'dark' ? 'bg-black/60 border-[#38383A]' : 'bg-white/60 border-[#D8D8DC]'
                }`}>
                <button
                    onClick={() => navigate(-1)}
                    className={`flex items-center text-[17px] font-medium transition-opacity hover:opacity-70 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        }`}
                >
                    <ArrowLeft size={20} className="mr-1" />
                    Back
                </button>
                <h1 className={`text-[17px] font-bold absolute left-1/2 -translate-x-1/2 ${theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]'
                    }`}>
                    Privacy
                </h1>
                <div className="w-10" /> {/* Spacer */}
            </div>

            <main className="max-w-3xl mx-auto px-6 pt-8 pb-20">
                {/* Brand Hero */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-10"
                >
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-[22px] flex items-center justify-center shadow-2xl ${theme === 'dark' ? 'bg-blue-600 shadow-blue-500/20' : 'bg-blue-600 shadow-blue-600/20'
                        }`}>
                        <Shield size={40} color="white" strokeWidth={1.5} />
                    </div>
                    <h2 className={`text-3xl font-extrabold tracking-tight mb-3 ${theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]'}`}>
                        Nasaka Privacy
                    </h2>
                    <p className={`text-[17px] max-w-md mx-auto ${theme === 'dark' ? 'text-ios-gray-400' : 'text-ios-gray-500'}`}>
                        Our commitment to your data sovereignty and secure access to IEBC office information.
                    </p>
                </motion.div>

                <div className="space-y-4">
                    <CollapsibleSection
                        id="data-mission"
                        title="The Nasaka Mission"
                        icon={Globe}
                        defaultExpanded={true}
                    >
                        <p className="mb-4">
                            Nasaka is built on the principle of <strong>Zero-Persistence Privacy</strong>. We believe that civic tools should empower you without monitoring you.
                        </p>
                        <div className={`p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
                            <p className={theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}>
                                <strong>Local Processing:</strong> Unlike typical apps, your GPS coordinates are processed exclusively on your device. We do not transmit your live location to our servers.
                            </p>
                        </div>
                        <p>
                            We provide a bridge between Kenyan citizens and IEBC constituency offices, ensuring that location data is used only to calculate routes and distances locally.
                        </p>
                    </CollapsibleSection>

                    <CollapsibleSection
                        id="information-we-process"
                        title="Information Processing"
                        icon={Database}
                    >
                        <p className="mb-4">We minimize data handling to the absolute essentials required for the app's functionality:</p>
                        <ul className="space-y-3">
                            <li className="flex items-start">
                                <span className={`mr-3 mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme === 'dark' ? 'bg-blue-400' : 'bg-blue-500'}`} />
                                <span><strong>Cached Office Data:</strong> We store a local copy of IEBC office locations on your device to enable offline access.</span>
                            </li>
                            <li className="flex items-start">
                                <span className={`mr-3 mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme === 'dark' ? 'bg-blue-400' : 'bg-blue-500'}`} />
                                <span><strong>Local Search History:</strong> Your recent searches are stored in your browser's local storage and are never uploaded.</span>
                            </li>
                            <li className="flex items-start">
                                <span className={`mr-3 mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme === 'dark' ? 'bg-blue-400' : 'bg-blue-500'}`} />
                                <span><strong>Anonymized Analytics:</strong> We use basic, privacy-preserving analytics to understand feature usage without identifying individual users.</span>
                            </li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection
                        id="security-standards"
                        title="Security Standards"
                        icon={Lock}
                    >
                        <p className="mb-4">Nasaka adheres to enterprise-grade security protocols to protect the integrity of the IEBC office registry:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#2C2C2E]' : 'bg-white border border-[#D8D8DC]'}`}>
                                <h4 className={`font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]'}`}>End-to-End SSL</h4>
                                <p className="text-sm opacity-80">All communication between the app and the IEBC registry is encrypted via TLS 1.3.</p>
                            </div>
                            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#2C2C2E]' : 'bg-white border border-[#D8D8DC]'}`}>
                                <h4 className={`font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]'}`}>Storage Guard</h4>
                                <p className="text-sm opacity-80">Local data is isolated using browser sandbox security to prevent cross-site access.</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection
                        id="legal-compliance"
                        title="Legal Compliance"
                        icon={Scale}
                    >
                        <p className="mb-4">Nasaka operates within the framework of Kenyan and International privacy laws:</p>
                        <ul className="space-y-2 text-sm opacity-90">
                            <li>• <strong>Data Protection Act (2019):</strong> We respect all "Data Subject" rights as defined by Kenyan law.</li>
                            <li>• <strong>Constitution of Kenya (Article 31):</strong> We uphold your fundamental right to privacy.</li>
                            <li>• <strong>Voter Privacy:</strong> Nasaka is independent and does not link location data with voter registration status.</li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection
                        id="contributions"
                        title="Community Contributions"
                        icon={Users}
                    >
                        <p>
                            When you contribute a missing office location, you choose to share that specific coordinate with the community.
                        </p>
                        <p className="mt-3">
                            Contributions are reviewed for accuracy but do not require you to provide personal identity documents. We leverage public verification to build a more accurate map for everyone.
                        </p>
                    </CollapsibleSection>
                </div>

                {/* Footer Disclaimer */}
                <div className="mt-12 text-center">
                    <p className={`text-xs ${theme === 'dark' ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>
                        Last Updated: February 22, 2026 • Version 2.1 (Nasaka Edition)<br />
                        Nasaka is a project by Civic Education Kenya.
                    </p>
                    <div className="mt-6 flex justify-center space-x-4">
                        <div className={`h-8 w-[1px] ${theme === 'dark' ? 'bg-[#38383A]' : 'bg-[#D8D8DC]'}`} />
                    </div>
                </div>
            </main>

            {/* Premium Text Shadow Overlays (Reused from Splash) */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .text-ios-gray-200 { color: rgba(235, 235, 245, 0.82); }
                .text-ios-gray-400 { color: rgba(235, 235, 245, 0.6); }
                .text-ios-gray-500 { color: rgba(60, 60, 67, 0.6); }
                .text-ios-gray-600 { color: rgba(60, 60, 67, 0.85); }
            `}} />
        </div>
    );
};

export default Privacy;
