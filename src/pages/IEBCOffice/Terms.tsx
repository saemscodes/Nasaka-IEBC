import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowLeft, Scale, Gavel, AlertTriangle, Shield, Users, FileText, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';

const Terms = () => {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ 'usage-intent': true });

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
                    Terms
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
                        <Scale size={40} color="white" strokeWidth={1.5} />
                    </div>
                    <h2 className={`text-3xl font-extrabold tracking-tight mb-3 ${theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]'}`}>
                        Service Terms
                    </h2>
                    <p className={`text-[17px] max-w-md mx-auto ${theme === 'dark' ? 'text-ios-gray-400' : 'text-ios-gray-500'}`}>
                        By using Nasaka, you agree to these conditions for accessing Kenyan electoral office data.
                    </p>
                </motion.div>

                <div className="space-y-4">
                    <CollapsibleSection
                        id="usage-intent"
                        title="Acceptable Usage"
                        icon={Smartphone}
                        defaultExpanded={true}
                    >
                        <p className="mb-4">
                            Nasaka is provided as a civic utility. It is intended for searching and locating official IEBC constituency offices within the Republic of Kenya.
                        </p>
                        <div className={`p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
                            <p className={theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}>
                                <strong>Prohibited:</strong> You may not use this service for harassment, illegal surveillance, or any activity that interferes with the peaceful operations of IEBC offices.
                            </p>
                        </div>
                        <p>
                            Scraping historical data or attempting to bypass rate limits on our API is strictly prohibited to ensure fair access for all citizens.
                        </p>
                    </CollapsibleSection>

                    <CollapsibleSection
                        id="data-accuracy"
                        title="Data Accuracy & Verification"
                        icon={AlertTriangle}
                    >
                        <p className="mb-4">While we strive for 100% accuracy, the registry is a living document:</p>
                        <ul className="space-y-3">
                            <li className="flex items-start">
                                <span className={`mr-3 mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme === 'dark' ? 'bg-blue-400' : 'bg-blue-500'}`} />
                                <span><strong>Community Moderation:</strong> Some locations are community-contributed and marked as "Unverified" until audited.</span>
                            </li>
                            <li className="flex items-start">
                                <span className={`mr-3 mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme === 'dark' ? 'bg-blue-400' : 'bg-blue-500'}`} />
                                <span><strong>Official Sources:</strong> Nasaka cross-references data with official IEBC gazettes, but boundaries and office moves may cause temporary discrepancies.</span>
                            </li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection
                        id="service-reliability"
                        title="Service Level & Availability"
                        icon={Shield}
                    >
                        <p className="mb-4">We aim to keep Nasaka available whenever it is needed most, especially during election cycles:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#2C2C2E]' : 'bg-white border border-[#D8D8DC]'}`}>
                                <h4 className={`font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]'}`}>Offline Mode</h4>
                                <p className="text-sm opacity-80">Our PWA technology allows you to access cached maps even without an active data connection.</p>
                            </div>
                            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#2C2C2E]' : 'bg-white border border-[#D8D8DC]'}`}>
                                <h4 className={`font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]'}`}>"As-Is" Policy</h4>
                                <p className="text-sm opacity-80">The service is provided without warranty. Use it as a guide, but always verify critical trips.</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection
                        id="intellectual-property"
                        title="Intellectual Property"
                        icon={Gavel}
                    >
                        <p className="mb-4">Nasaka's code and unique datasets are protected:</p>
                        <ul className="space-y-2 text-sm opacity-90">
                            <li>• <strong>Framework:</strong> The Nasaka platform design and UI system belong to Civic Education Kenya.</li>
                            <li>• <strong>Registry:</strong> The compiled constituency dataset is a community resource managed by Nasaka.</li>
                            <li>• <strong>Attribution:</strong> Map tiles are provided by OpenStreetMap contributors under ODbL licenses.</li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection
                        id="legal-jurisdiction"
                        title="Jurisdiction & Disputes"
                        icon={Scale}
                    >
                        <p>
                            These terms are governed by the Laws of the Republic of Kenya.
                        </p>
                        <p className="mt-3">
                            By using the app, you consent to the exclusive jurisdiction of Kenyan courts for any disputes arising from the use of the platform.
                        </p>
                    </CollapsibleSection>
                </div>

                {/* Footer Disclaimer */}
                <div className="mt-12 text-center">
                    <p className={`text-[13px] ${theme === 'dark' ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>
                        By continuing to use Nasaka, you acknowledge that you have read and understood these Terms of Service.
                    </p>
                    <div className="mt-8 flex justify-center space-x-4">
                        <FileText size={24} className={theme === 'dark' ? 'text-ios-gray-700' : 'text-ios-gray-200'} strokeWidth={1} />
                    </div>
                </div>
            </main>

            {/* Premium Text Shadow Overlays */}
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

export default Terms;
