import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ArrowLeft, Scale, Gavel, AlertTriangle, Shield, Users,
    FileText, Smartphone, UserCheck, Accessibility, Ban, Settings,
    MessageSquare, HelpCircle, Info, Landmark, Code, Share2,
    Lock as LockIcon, Globe as GlobeIcon, Vote, RefreshCcw, Mail
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
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

                    <Link
                        to="/iebc-office/privacy"
                        className={`mt-8 inline-flex items-center space-x-2 px-6 py-3 rounded-full border transition-all duration-300 ${theme === 'dark'
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                            : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                            } text-[15px] font-bold shadow-lg backdrop-blur-md`}
                    >
                        <Shield size={18} strokeWidth={2.5} />
                        <span>View Privacy Policy</span>
                    </Link>
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
                    <CollapsibleSection id="t1" title="1. Platform Overview & Legal Status" icon={Landmark}>
                        <p className="mb-4">
                            <strong>Nasaka IEBC</strong> is an independent, non-partisan civic technology platform developed and maintained by <strong>Civic Education Kenya (CEKA)</strong>, a non-governmental organisation registered in the Republic of Kenya.
                        </p>
                        <p className="mb-4">
                            <strong>Independent Resource:</strong> We are not affiliated with, endorsed by, or representing the Independent Electoral and Boundaries Commission (IEBC) of Kenya. Nasaka acts solely as an aggregator of public information to facilitate civic participation.
                        </p>
                        <p className="mb-4">
                            <strong>Agreement:</strong> These Terms of Service constitute a legally binding agreement between you and CEKA. By accessing the platform (at recall254.vercel.app), you acknowledge that you have read, understood, and agreed to be bound by these Terms and our Privacy Policy.
                        </p>
                        <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}>
                            <p className="text-xs text-red-500 font-bold">NASAKA IS NOT THE IEBC. We have no authority over voter registration, election results, or official electoral processes in Kenya.</p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t2" title="2. Eligibility & User Access" icon={UserCheck}>
                        <p className="mb-4 text-sm opacity-80">By using Nasaka, you represent and warrant that you meet the following criteria:</p>
                        <div className="space-y-4">
                            <div className="flex gap-4 p-3 rounded-xl border border-white/5">
                                <div className="p-2 bg-blue-500/10 rounded-lg h-fit text-blue-500"><Users size={16} /></div>
                                <div>
                                    <h5 className="text-sm font-bold">Minimum Age</h5>
                                    <p className="text-xs opacity-60">You must be at least 13 years old. Users aged 13-17 require the supervision and explicit consent of a parent or legal guardian.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 p-3 rounded-xl border border-white/5">
                                <div className="p-2 bg-blue-500/10 rounded-lg h-fit text-blue-500"><LockIcon size={16} /></div>
                                <div>
                                    <h5 className="text-sm font-bold">No Personal Files</h5>
                                    <p className="text-xs opacity-60">Core features (searching IEBC offices) require no account, login, or National ID input. We do not maintain user profiles for the general public.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 p-3 rounded-xl border border-white/5">
                                <div className="p-2 bg-blue-500/10 rounded-lg h-fit text-blue-500"><GlobeIcon size={16} /></div>
                                <div>
                                    <h5 className="text-sm font-bold">Jurisdiction</h5>
                                    <p className="text-xs opacity-60">Nasaka is designed for use in Kenya. If you access the service from abroad, you are responsible for compliance with your local laws.</p>
                                </div>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t3" title="3. Acceptable Use Policy" icon={Smartphone}>
                        <p className="mb-4">You agree to use Nasaka only for lawful civic purposes that strengthen Kenya's democracy. Permitted uses include:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold text-sm mb-2 text-blue-500">Citizen Use</h4>
                                <ul className="text-xs opacity-70 space-y-2">
                                    <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />Finding constituency IEBC offices for registration</li>
                                    <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />Sharing office navigation links with other citizens</li>
                                    <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />Journalism and independent academic research</li>
                                </ul>
                            </div>
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold text-sm mb-2 text-blue-500">Innovation Use</h4>
                                <ul className="text-xs opacity-70 space-y-2">
                                    <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />Building pro-democracy apps via our open API</li>
                                    <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />Contributing metadata to improve dataset accuracy</li>
                                    <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />Integrating maps into civic education websites</li>
                                </ul>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t4" title="4. Prohibited Conduct & Integrity" icon={Ban}>
                        <p className="mb-4 text-sm opacity-80">Any violation of these standards will result in immediate suspension of access and potential legal referral:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
                                <h4 className="font-bold text-sm mb-2 text-red-500">Malicious Behavior</h4>
                                <ul className="text-xs space-y-2 opacity-80">
                                    <li>• Harassing IEBC staff or electoral officials</li>
                                    <li>• Submitting false office locations or hours</li>
                                    <li>• Automated scraping outside the API agreement</li>
                                    <li>• Attempting to disrupt platform availability</li>
                                </ul>
                            </div>
                            <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
                                <h4 className="font-bold text-sm mb-2 text-red-500">Democratic Interference</h4>
                                <ul className="text-xs space-y-2 opacity-80">
                                    <li>• Using data for voter targeting or surveillance</li>
                                    <li>• Building tools for election interference</li>
                                    <li>• Impersonating IEBC officials or CEKA staff</li>
                                    <li>• Removing legal attribution from the dataset</li>
                                </ul>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t5" title="5. Data Accuracy & Responsibility" icon={Shield}>
                        <p className="text-sm opacity-90 mb-4">While we strive for 100% accuracy, IEBC office locations and contact details can change without notice. Information on Nasaka is provided "as is" for indicative purposes only.</p>
                        <div className="space-y-4">
                            <div className={`p-4 rounded-xl border border-ios-gray-500/20 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h5 className="font-bold text-sm mb-1 text-blue-500">Final Logistics Authority</h5>
                                <p className="text-xs opacity-70">The Independent Electoral and Boundaries Commission (IEBC) remains the sole official authority for electoral logistics. You must verify time-sensitive info directly with the Commission.</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="px-2 py-1 rounded-md bg-green-500/10 text-[10px] font-bold text-green-500">VERIFIED LISTING (Internal Review Completed)</span>
                                <span className="px-2 py-1 rounded-md bg-amber-500/10 text-[10px] font-bold text-ios-gray-500">UNVERIFIED (Community Submission)</span>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t6" title="6. Availability & Service Level Support" icon={Accessibility}>
                        <p className="mb-4">Nasaka is a free civic service provided on an "as available" basis. We aim to keep the registry accessible 24/7, but we make no formal uptime guarantees.</p>
                        <div className="space-y-3">
                            <div className="p-3 rounded-xl border border-white/5 text-xs">
                                <span className="font-bold">No SLA:</span> We do not provide a formal Service Level Agreement. Maintenance or outages may occur without notice during standard technical updates.
                            </div>
                            <div className="p-3 rounded-xl border border-white/5 text-xs">
                                <span className="font-bold">Peak Scaling:</span> During high-traffic electoral periods, we reserve the right to prioritize core search functions and limit auxiliary features to ensure platform stability.
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t7" title="7. Intellectual Property & Data Ownership" icon={FileText}>
                        <p className="mb-4 text-sm opacity-80">Understanding the ownership and licensing of the Nasaka platform:</p>
                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold">Platform UI & Code</h5>
                                    <p className="text-xs opacity-70">The Nasaka interface, branding, and proprietary source code are owned by Civic Education Kenya (CEKA). All rights reserved.</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold">Office Registry Data</h5>
                                    <p className="text-xs opacity-70">The geographic and administrative data within the registry is licensed under the <strong>Open Database License (ODbL) 1.0</strong>. You are free to copy and adapt the data, provided you credit Nasaka IEBC and CEKA.</p>
                                </div>
                            </li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection id="t8" title="8. API & Developer Terms" icon={Code}>
                        <p className="mb-4 text-sm">Developers using the Nasaka API to build civic tools must adhere to these standards:</p>
                        <div className="space-y-3 mb-4">
                            <div className="flex items-center justify-between text-xs p-3 rounded-lg border border-white/5">
                                <span>Free Tier Rate Limit</span>
                                <span className="font-bold text-blue-500">100 Requests/Hr</span>
                            </div>
                            <div className="flex items-center justify-between text-xs p-3 rounded-lg border border-white/5">
                                <span>Mandatory Attribution</span>
                                <span className="font-bold text-blue-500">"Powered by Nasaka"</span>
                            </div>
                        </div>
                        <div className={`p-4 rounded-xl border border-red-500/20 ${theme === 'dark' ? 'bg-red-500/5' : 'bg-red-50'}`}>
                            <p className="text-[11px] text-red-500 font-bold uppercase tracking-tight">Prohibited: Political profiling, voter targeting, or building partisan campaign tools via the API is strictly forbidden and results in an immediate permanent ban.</p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t9" title="9. Community Contributions Policy" icon={Share2}>
                        <p className="text-sm opacity-90 mb-4">By submitting verification reports, photos, or office updates, you grant CEKA a perpetual, worldwide, royalty-free license to use, modify, and publish that content as part of the open dataset.</p>
                        <div className={`p-4 rounded-xl border border-blue-500/10 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                            <h5 className="font-bold text-xs mb-1">Accuracy Warranty</h5>
                            <p className="text-[11px] opacity-60">You represent that any information you submit is accurate to the best of your knowledge and does not violate the rights of any third party.</p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t10" title="10. Content & Moderation Standards" icon={MessageSquare}>
                        <p className="mb-4 text-sm opacity-80">All community contributions must be civil. Prohibited content includes:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[
                                { t: 'Electoral Disinformation', d: 'False claims about polling stations' },
                                { t: 'Private Information', d: 'National IDs or private phone numbers' },
                                { t: 'Hate Speech', d: 'Discrimination based on ethnicity or religion' },
                                { t: 'Identity Theft', d: 'Impersonating IEBC officials or staff' }
                            ].map((item, i) => (
                                <div key={i} className="p-3 rounded-xl border border-white/5">
                                    <div className="text-[12px] font-bold text-red-500 underline mb-1">{item.t}</div>
                                    <div className="text-[11px] opacity-60">{item.d}</div>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t11" title="11. Comprehensive Warranty Disclaimer" icon={Info}>
                        <div className={`p-5 rounded-2xl border-2 italic text-center ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                            <p className="text-xs uppercase font-bold mb-2">Notice to Users</p>
                            <p className="text-xs leading-relaxed opacity-80">NASAKA IS PROVIDED "AS IS" AND "AS AVAILABLE". CEKA DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE DATA IS ERROR-FREE OR COMPLETE.</p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t12" title="12. Limitation of Liability" icon={Shield}>
                        <p className="text-xs leading-relaxed opacity-80">TO THE MAXIMUM EXTENT PERMITTED BY KENYAN LAW, CEKA AND ITS CONTRIBUTORS SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING OUT OF YOUR USE OR INABILITY TO USE THE PLATFORM. THIS INCLUDES RELIANCE ON INCORRECT OFFICE COORDINATES OR ELECTION-RELATED MISUNDERSTANDINGS.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t13" title="13. Indemnification" icon={Scale}>
                        <p className="text-xs leading-relaxed opacity-80">You agree to indemnify, defend, and hold harmless Civic Education Kenya (CEKA), its directors, and volunteers from any claims, damages, or losses arising from your breach of these Terms, your misuse of the platform, or your violation of any third-party rights.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t14" title="14. Electoral Integrity & Absolute Neutrality" icon={Vote}>
                        <p className="mb-4">Civic Education Kenya (CEKA) and the Nasaka platform are strictly non-partisan. Our mission is to empower the citizen, not the candidate.</p>
                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold">Neutrality Absolute</h5>
                                    <p className="text-xs opacity-70">We do not endorse any political party, candidate, or coalition. The platform is a neutral civic utility designed to serve all Kenyans equally regardless of political affiliation.</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold">Reporting Misuse</h5>
                                    <p className="text-xs opacity-70">We reserve the right to report any attempts to use Nasaka for electoral fraud or interference to the IEBC and the Office of the Data Protection Commissioner (ODPC).</p>
                                </div>
                            </li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection id="t15" title="15. Accessibility & Universal Design" icon={Accessibility}>
                        <p className="mb-4 text-sm opacity-80">We are committed to making civic information accessible to all Kenyans, regardless of physical ability or technical infrastructure.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] opacity-80">
                            <div className="p-2 rounded-lg bg-blue-500/5 border border-white/5 font-medium text-blue-500">Low-bandwidth (2G/3G) UI Optimization</div>
                            <div className="p-2 rounded-lg bg-blue-500/5 border border-white/5 font-medium text-blue-500">Kiswahili Summaries & Context</div>
                            <div className="p-2 rounded-lg bg-blue-500/5 border border-white/5 font-medium text-blue-500">WCAG 2.1 Level AA Compliance Goals</div>
                            <div className="p-2 rounded-lg bg-blue-500/5 border border-white/5 font-medium text-blue-500">Screen-reader & Contrast Optimization</div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="t16" title="16. Termination of Access" icon={Ban}>
                        <p className="text-sm opacity-80 mb-2">CEKA reserves the right to suspend or terminate your access to the platform or API at any time, without prior notice, if we believe you have violated these Terms or the acceptable use policy.</p>
                        <p className="text-xs italic opacity-60">Upon termination, your right to use the service and any associated data access will cease immediately.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t17" title="17. Modifications to Service & Terms" icon={Settings}>
                        <p className="text-sm opacity-80 mb-2">We may modify, enhance, or discontinue any part of the Nasaka platform at our discretion. We reserve the right to update these Terms at any time.</p>
                        <p className="text-xs italic opacity-60">Your continued use of the platform after changes are posted signifies your acceptance of the revised Terms.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t18" title="18. Jurisdiction & Dispute Resolution" icon={Scale}>
                        <p className="text-sm opacity-80">Disputes shall be handled by the courts of the Republic of Kenya. Any dispute arising from these Terms shall first be resolved through amicable mediation conducted in Nairobi.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t19" title="19. Governing Law" icon={Landmark}>
                        <p className="text-sm opacity-80">This agreement is governed exclusively by the Constitution of Kenya 2010 and the statutory laws of the Republic of Kenya.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t20" title="20. Entire Agreement" icon={FileText}>
                        <p className="text-sm opacity-80">These Terms of Service, together with our Privacy Policy, constitute the entire agreement between you and Civic Education Kenya (CEKA) regarding the Nasaka platform.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="t21" title="21. Legal Notices & Correspondence" icon={HelpCircle}>
                        <div className={`p-6 rounded-3xl ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-600'} text-white shadow-xl`}>
                            <h4 className="font-bold text-xl mb-1">Civic Education Kenya</h4>
                            <p className="text-sm opacity-90 mb-4">Official legal notices must be sent to:</p>
                            <div className="space-y-3 text-sm font-medium">
                                <div className="flex justify-between items-center border-b border-white/20 pb-2">
                                    <span>Support Email</span>
                                    <span className="font-bold">contact@civiceducationkenya.com</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>Subject Line</span>
                                    <span className="font-bold">Legal Notice - Nasaka</span>
                                </div>
                            </div>
                        </div>
                    </CollapsibleSection>
                </div>

                {/* Footer Disclaimer */}
                <div className="mt-16 text-center">
                    <div className="w-12 h-1 bg-blue-500/20 mx-auto mb-8 rounded-full" />
                    <p className={`text-[13px] font-semibold tracking-wide ${theme === 'dark' ? 'text-ios-gray-400' : 'text-ios-gray-600'}`}>
                        {new Date().getFullYear()} © <a href="https://civiceducationkenya.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 underline decoration-blue-500/30 transition-colors">Civic Education Kenya (CEKA)</a>.<br />
                        <span className="opacity-60 font-medium italic">"The sovereignty of the people shall be exercised in accordance with this Constitution" — Article 1(3).</span>
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
