import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ArrowLeft, Scale, Gavel, AlertTriangle, Shield, Users,
    FileText, Smartphone, UserCheck, Accessibility, Ban, Settings,
    MessageSquare, HelpCircle, Info, Landmark, Code, Share2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';

const Terms = () => {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ 't1': true });

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
                id={id}
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
                <div className="flex flex-col items-center">
                    <h1 className={`text-[17px] font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]'}`}>
                        Service Terms
                    </h1>
                    <span className="text-[10px] uppercase tracking-widest opacity-50 font-semibold">Nasaka IEBC</span>
                </div>
                <div className="w-10" />
            </div>

            <main className="max-w-4xl mx-auto px-6 pt-8 pb-20">
                {/* Brand Hero */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center mb-10"
                >
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-[22px] flex items-center justify-center shadow-2xl relative ${theme === 'dark' ? 'bg-blue-600 shadow-blue-500/20' : 'bg-blue-600 shadow-blue-600/20'
                        }`}>
                        <Scale size={40} color="white" strokeWidth={1.5} />
                    </div>
                    <h2 className={`text-4xl font-extrabold tracking-tight mb-4 ${theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]'}`}>
                        Terms of Service
                    </h2>
                    <p className={`text-[17px] max-w-xl mx-auto mb-6 ${theme === 'dark' ? 'text-ios-gray-400' : 'text-ios-gray-500'}`}>
                        The full and binding terms for using the Nasaka IEBC platform, API, and civic services.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4 text-xs font-medium opacity-60">
                        <span>📅 Effective: 1 Feb 2025</span>
                        <span>🔄 Updated: 22 Feb 2026</span>
                        <span>🇰🇪 Kenya Law</span>
                        <span>📋 Version 2.0</span>
                    </div>
                </motion.div>

                {/* Agreement Banner */}
                <div className={`mb-12 p-5 rounded-2xl border-l-[6px] shadow-sm ${theme === 'dark'
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-200'
                    : 'bg-amber-50 border-amber-500 text-amber-900'
                    }`}>
                    <div className="flex gap-4">
                        <AlertTriangle className="flex-shrink-0" size={24} />
                        <p className="text-[14px] leading-relaxed">
                            <strong>By using Nasaka, you agree to these Terms.</strong> These Terms constitute a legally binding agreement between you and Civic Education Kenya (CEKA). If you do not agree, you must stop using the platform immediately.
                        </p>
                    </div>
                </div>

                {/* Table of Contents */}
                <div className={`mb-12 rounded-2xl border p-2 ${theme === 'dark' ? 'bg-[#1C1C1E]/40 border-[#38383A]' : 'bg-white/40 border-[#D8D8DC]'} backdrop-blur-xl`}>
                    <div className="px-4 py-3 border-b border-white/5 opacity-50 text-[11px] font-bold uppercase tracking-wider">Table of Contents</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 p-2">
                        {[
                            { id: 't1', title: '1. Platform Overview' },
                            { id: 't2', title: '2. Eligibility & Access' },
                            { id: 't3', title: '3. Acceptable Use' },
                            { id: 't4', title: '4. Prohibited Conduct' },
                            { id: 't5', title: '5. Data Accuracy' },
                            { id: 't6', title: '6. Availability & SLA' },
                            { id: 't7', title: '7. Intellectual Property' },
                            { id: 't8', title: '8. API & Developer Terms' },
                            { id: 't9', title: '9. Community Terms' },
                            { id: 't10', title: '10. UGC Standards' },
                            { id: 't11', title: '11. Warranty Disclaimer' },
                            { id: 't12', title: '12. Liability Limits' },
                            { id: 't13', title: '13. Indemnification' },
                            { id: 't14', title: '14. Electoral Integrity' },
                            { id: 't15', title: '15. Accessibility' },
                            { id: 't16', title: '16. Termination' },
                            { id: 't17', title: '17. Modifications' },
                            { id: 't18', title: '18. Jurisdiction' },
                            { id: 't19', title: '19. Governing Law' },
                            { id: 't20', title: '20. Entire Agreement' },
                            { id: 't21', title: '21. Legal Notices' },
                        ].map(item => (
                            <a
                                key={item.id}
                                href={`#${item.id}`}
                                onClick={(e) => { e.preventDefault(); setExpandedSections(v => ({ ...v, [item.id]: true })); document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }); }}
                                className={`px-4 py-2 rounded-xl text-[12px] font-medium transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-ios-gray-200' : 'hover:bg-black/5 text-ios-gray-600'
                                    }`}
                            >
                                {item.title}
                            </a>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <CollapsibleSection id="t1" title="1. Platform Overview" icon={Landmark}>
                        <p className="mb-4">
                            <strong>Operator:</strong> Nasaka IEBC is maintained by <strong>Civic Education Kenya (CEKA)</strong>.
                        </p>
                        <p className="mb-4 text-sm opacity-90">
                            <strong>What it is:</strong> An independent civic utility that aggregates public IEBC office info.
                        </p>
                        <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}>
                            <p className="text-xs text-red-500 font-bold">NASAKA IS NOT THE IEBC. We are an independent resource with no authority over official registration.</p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t2" title="2. Eligibility & Access" icon={UserCheck}>
                        <ul className="space-y-3 text-sm">
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <span><strong>Age:</strong> Minimum 13 years. Users 13–17 require guardian consent. Voter guidance features are for 18+.</span>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <span><strong>No Account:</strong> Browsing office locations requires no login or personal data.</span>
                            </li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection id="t3" title="3. Acceptable Use" icon={Smartphone}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold text-sm mb-1">Permitted</h4>
                                <ul className="text-xs opacity-70 space-y-1">
                                    <li>• Finding IEBC offices for registration</li>
                                    <li>• Sharing office links with citizens</li>
                                    <li>• Civic education & journalism</li>
                                </ul>
                            </div>
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold text-sm mb-1 text-blue-500">Devs</h4>
                                <p className="text-xs opacity-70">Building non-commercial apps via the open API is encouraged.</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t4" title="4. Prohibited Conduct" icon={Ban}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
                                <h4 className="font-bold text-sm mb-2 text-red-500">Platform Abuse</h4>
                                <ul className="text-xs space-y-2 opacity-80">
                                    <li>• Harassing IEBC staff or voters</li>
                                    <li>• Submitting false office locations</li>
                                    <li>• Scraping without API agreement</li>
                                </ul>
                            </div>
                            <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
                                <h4 className="font-bold text-sm mb-2 text-red-500">Data Misuse</h4>
                                <ul className="text-xs space-y-2 opacity-80">
                                    <li>• Voter targeting or profiling</li>
                                    <li>• Election interference tools</li>
                                    <li>• Removing attribution notices</li>
                                </ul>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t5" title="5. Data Accuracy" icon={Shield}>
                        <p className="text-sm opacity-90 mb-4">treat unverified listings as indicative. Always verify with IEBC for time-sensitive electoral activities.</p>
                        <div className="flex gap-2 mb-4">
                            <span className="px-2 py-1 rounded-md bg-green-500/10 text-[10px] font-bold text-green-500">VERIFIED</span>
                            <span className="px-2 py-1 rounded-md bg-amber-500/10 text-[10px] font-bold text-amber-500">COMMUNITY</span>
                            <span className="px-2 py-1 rounded-md bg-ios-gray-500/10 text-[10px] font-bold">UNVERIFIED</span>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t6" title="6. Availability & SLA" icon={Accessibility}>
                        <p className="text-sm opacity-80">Nasaka is a free civic service. We aim for high availability but provide no formal uptime guarantees (SLAs).</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t7" title="7. Intellectual Property" icon={FileText}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
                            <div className="p-3 border border-white/10 rounded-xl">
                                <h5 className="font-bold mb-1">Platform UI</h5>
                                <span className="opacity-50">© CEKA (All Rights Reserved)</span>
                            </div>
                            <div className="p-3 border border-white/10 rounded-xl">
                                <h5 className="font-bold mb-1">Office Registry</h5>
                                <span className="opacity-50 text-blue-500">ODbL 1.0 (Open Database)</span>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t8" title="8. API & Developer Terms" icon={Code}>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs p-2 border-b border-white/5">
                                <span>Free Tier Limit</span>
                                <span className="font-bold">100 req/hr</span>
                            </div>
                            <div className="flex items-center justify-between text-xs p-2 border-b border-white/5">
                                <span>Attribution</span>
                                <span className="font-bold text-blue-500">REQUIRED</span>
                            </div>
                            <p className="text-[11px] opacity-60 italic">Political targeting via API is Grounds for immediate permanent ban.</p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t9" title="9. Community Terms" icon={Share2}>
                        <p className="text-sm opacity-90">By submitting data, you grant CEKA a perpetual, royalty-free license to publish and modify your contribution as part of the open dataset.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t10" title="10. UGC Standards" icon={MessageSquare}>
                        <ul className="text-xs space-y-2 opacity-70">
                            <li>• No hate speech or discrimination</li>
                            <li>• No electoral disinformation</li>
                            <li>• No private info (ID/Phone) of third parties</li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection id="t11" title="11. Warranty Disclaimer" icon={Info}>
                        <p className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs italic">
                            NASAKA IS PROVIDED "AS IS". WE DO NOT WARRANT ACCURACY, COMPLETENESS, OR UNINTERRUPTED SERVICE.
                        </p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t12" title="12. Liability Limits" icon={Shield}>
                        <p className="text-xs opacity-70">CEKA is not liable for indirect or consequential damages. Aggregate liability is capped at KES 5,000.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t13" title="13. Indemnification" icon={Scale}>
                        <p className="text-xs opacity-70">You agree to indemnify CEKA for any loss arising from your violation of these terms or misuse of the platform.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t14" title="14. Electoral Integrity" icon={Gavel}>
                        <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-600'} text-white shadow-lg`}>
                            <h4 className="font-bold mb-2">Neutrality Absolute</h4>
                            <p className="text-xs opacity-90">Nasaka is strictly non-partisan. We report any misuse for electoral interference to the IEBC and ODPC.</p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t15" title="15. Accessibility" icon={Accessibility}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] opacity-80">
                            <div>• Low-bandwidth (2G/3G) UI</div>
                            <div>• Swahili summaries</div>
                            <div>• WCAG 2.1 Level AA goal</div>
                            <div>• Screen-reader optimization</div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t16" title="16. Termination" icon={Ban}>
                        <p className="text-sm">We may suspend accounts for breaches of the Acceptable Use Policy without prior notice.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t17" title="17. Modifications" icon={Settings}>
                        <p className="text-sm">CEKA reserves the right to modify services or these terms at any time.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t18" title="18. Jurisdiction" icon={Scale}>
                        <p className="text-sm">Disputes shall be handled by the courts of the Republic of Kenya.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t19" title="19. Governing Law" icon={Landmark}>
                        <p className="text-sm">Governed exclusively by the Laws of Kenya and the Constitution of 2010.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t20" title="20. Entire Agreement" icon={FileText}>
                        <p className="text-sm">These terms constitute the entire agreement between you and CEKA.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t21" title="21. Legal Notices" icon={HelpCircle}>
                        <div className={`p-6 rounded-3xl ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-600'} text-white shadow-xl`}>
                            <h4 className="font-bold text-xl mb-2">Civic Education Kenya</h4>
                            <p className="text-sm opacity-90 mb-4">Official legal notices must be sent to:</p>
                            <div className="space-y-2 text-sm font-medium">
                                <div className="flex justify-between">
                                    <span>Support Email:</span>
                                    <span className="font-bold">contact@civiceducationkenya.com</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Subject:</span>
                                    <span className="font-bold">Legal Notice - Nasaka</span>
                                </div>
                            </div>
                        </div>
                    </CollapsibleSection>
                </div>

                {/* Footer Disclaimer */}
                <div className="mt-16 text-center">
                    <div className="w-12 h-1 bg-blue-500/20 mx-auto mb-8 rounded-full" />
                    <p className={`text-[13px] font-medium ${theme === 'dark' ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>
                        2026 © Civic Education Kenya (CEKA).<br />
                        "The sovereignty of the people shall be exercised in accordance with this Constitution" — Article 1(3).
                    </p>
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
