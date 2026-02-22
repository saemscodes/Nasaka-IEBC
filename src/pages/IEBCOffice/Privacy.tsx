import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ArrowLeft, Shield, Scale, Database, Lock, Users,
    FileText, Globe, Target, AlertTriangle, EyeOff, LayoutGrid,
    Cookie, Share2, Server, Trash2, UserCheck, Baby, Vote, ExternalLink,
    RefreshCcw, Mail
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';

const Privacy = () => {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ 's1': true });

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
                        Privacy Policy
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
                    className="text-center mb-12"
                >
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-[22px] flex items-center justify-center shadow-2xl relative ${theme === 'dark' ? 'bg-blue-600 shadow-blue-500/20' : 'bg-blue-600 shadow-blue-600/20'
                        }`}>
                        <Shield size={40} color="white" strokeWidth={1.5} />
                    </div>
                    <h2 className={`text-4xl font-extrabold tracking-tight mb-4 ${theme === 'dark' ? 'text-white' : 'text-[#1C1C1E]'}`}>
                        Privacy Policy
                    </h2>
                    <p className={`text-[17px] max-w-xl mx-auto mb-6 ${theme === 'dark' ? 'text-ios-gray-400' : 'text-ios-gray-500'}`}>
                        Our full, unabridged commitment to your data sovereignty and the protection of your personal information.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4 text-xs font-medium opacity-60">
                        <span>📅 Effective: 1 Feb 2025</span>
                        <span>🔄 Updated: 22 Feb 2026</span>
                        <span>🇰🇪 Kenya Law</span>
                        <span>📋 Version 2.0</span>
                    </div>
                </motion.div>

                {/* Table of Contents - iOS Style list */}
                <div className={`mb-12 rounded-2xl border p-2 ${theme === 'dark' ? 'bg-[#1C1C1E]/40 border-[#38383A]' : 'bg-white/40 border-[#D8D8DC]'} backdrop-blur-xl`}>
                    <div className="px-4 py-3 border-b border-white/5 opacity-50 text-[11px] font-bold uppercase tracking-wider">Table of Contents</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1 p-2">
                        {[
                            { id: 's1', title: '1. Who We Are & This Policy' },
                            { id: 's2', title: '2. Our Zero-Persistence Mission' },
                            { id: 's3', title: '3. Information We Collect' },
                            { id: 's4', title: '4. How We Use Information' },
                            { id: 's5', title: '5. Information We Do NOT Collect' },
                            { id: 's6', title: '6. Local Processing' },
                            { id: 's7', title: '7. Cookies & Tracking' },
                            { id: 's8', title: '8. Community Contributions' },
                            { id: 's9', title: '9. Data Sharing & Disclosure' },
                            { id: 's10', title: '10. Third-Party Services' },
                            { id: 's11', title: '11. Security Standards' },
                            { id: 's12', title: '12. Data Retention' },
                            { id: 's13', title: '13. Your Rights' },
                            { id: 's14', title: "14. Children's Privacy" },
                            { id: 's15', title: '15. Electoral & Biometric Data' },
                            { id: 's16', title: '16. International Users' },
                            { id: 's17', title: '17. Legal Compliance' },
                            { id: 's18', title: '18. Policy Changes' },
                            { id: 's19', title: '19. Contact & DPO' },
                        ].map(item => (
                            <a
                                key={item.id}
                                href={`#${item.id}`}
                                onClick={(e) => { e.preventDefault(); setExpandedSections(v => ({ ...v, [item.id]: true })); document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }); }}
                                className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-ios-gray-200' : 'hover:bg-black/5 text-ios-gray-600'
                                    }`}
                            >
                                {item.title}
                            </a>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <CollapsibleSection id="s1" title="1. Who We Are & Scope" icon={Globe}>
                        <p className="mb-4">
                            <strong>Nasaka IEBC</strong> (operating at <em>recall254.vercel.app</em>) is an independent civic technology platform developed and maintained by <strong>Civic Education Kenya (CEKA)</strong>, a non-governmental civic education organisation registered in the Republic of Kenya.
                        </p>
                        <p className="mb-4">
                            This Privacy Policy applies to all users of the Nasaka platform, including its web application, Progressive Web App (PWA), developer API, open dataset, and any associated community or verification workflows. It explains what information we collect, why we collect it, how we use and protect it, and what rights you have over your data.
                        </p>
                        <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
                            <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                                <strong>Independent Resource:</strong> Nasaka is an independent civic resource. We are not affiliated with, endorsed by, or acting as an agent of the Independent Electoral and Boundaries Commission (IEBC) of Kenya.
                            </p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s2" title="2. Zero-Persistence Privacy" icon={Target}>
                        <p className="mb-4">
                            Nasaka is built on the principle of <strong>Zero-Persistence Privacy</strong>: civic tools should empower citizens without monitoring them. We believe you should be able to find your IEBC office without leaving a personal data trail.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold mb-2">Local-First</h4>
                                <p className="text-sm opacity-80">Your GPS coordinates and search queries are processed exclusively on your device. We do not transmit your live location to our servers.</p>
                            </div>
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold mb-2">No Profiling</h4>
                                <p className="text-sm opacity-80">We do not build profiles based on your usage patterns, browsing history, or political interests.</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s3" title="3. Information We Collect" icon={Database}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="opacity-50 text-[10px] uppercase tracking-widest font-bold">
                                    <tr>
                                        <th className="pb-3 pr-4">Category</th>
                                        <th className="pb-3 pr-4">Detail</th>
                                        <th className="pb-3">Storage</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    <tr>
                                        <td className="py-3 pr-4 font-semibold">Location</td>
                                        <td className="py-3 pr-4">GPS coordinates for "nearest office"</td>
                                        <td className="py-3">Device only</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 pr-4 font-semibold">Searches</td>
                                        <td className="py-3 pr-4">County/Ward names searched</td>
                                        <td className="py-3">Browser Storage</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 pr-4 font-semibold">PWA Cache</td>
                                        <td className="py-3 pr-4">Offline maps and metadata</td>
                                        <td className="py-3">Device Cache</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 pr-4 font-semibold">Reports</td>
                                        <td className="py-3 pr-4">Voluntary verification contributions</td>
                                        <td className="py-3">Secure Servers</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s4" title="4. How We Use Information" icon={FileText}>
                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <span><strong>Nearest office calculation:</strong> Location coordinates are used solely to calculate distance. This computation happens on your device.</span>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <span><strong>Offline access:</strong> Cached office data is stored locally to make the app function without an internet connection.</span>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <span><strong>Accuracy improvement:</strong> Community verification reports are used to update incorrect or outdated IEBC office listings.</span>
                            </li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection id="s5" title="5. We Do NOT Collect" icon={EyeOff}>
                        <div className={`p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}>
                            <p className={`text-sm ${theme === 'dark' ? 'text-red-300' : 'text-red-700'}`}>
                                <strong>Voter Privacy Guarantee:</strong> Nasaka does not link or attempt to determine your voter registration status. We do not know if you are registered or how you vote.
                            </p>
                        </div>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm opacity-80">
                            <li>• No National ID Numbers</li>
                            <li>• No Voter Registration Numbers</li>
                            <li>• No Biometric Data</li>
                            <li>• No Financial Information</li>
                            <li>• No Political Affiliation</li>
                            <li>• No Persistent Identity Tracking</li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection id="s6" title="6. Local Processing" icon={LayoutGrid}>
                        <p className="mb-4">Nasaka is designed to run entirely within your browser or device. This architecture choice protects your privacy by default.</p>
                        <div className="space-y-3">
                            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold text-sm mb-1 text-blue-500">How to clear data</h4>
                                <p className="text-xs opacity-70">Delete all locally-stored Nasaka data by clearing your browser's cache and site data (Settings → Privacy → Clear browsing data → Site data).</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s7" title="7. Cookies & Tracking" icon={Cookie}>
                        <div className={`p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
                            <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                                <strong>No Advertising Cookies:</strong> Nasaka does not use Google AdSense, Facebook Pixel, or any advertising tracking technology.
                            </p>
                        </div>
                        <p className="text-sm opacity-80">We use LocalStorage for preferences, Service Worker Cache for offline data, and Privacy-first Analytics for anonymous usage stats.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="s8" title="8. Community Contributions" icon={Share2}>
                        <p className="mb-4">Verification reports from the community are reviewed by our team. We minimize data collection here, requesting only what is needed to validate your report.</p>
                        <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
                            <p className="text-xs"><strong>Photo Protocol:</strong> We strip EXIF metadata (GPS coordinates) from photos and reject images that clearly identify individuals.</p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s9" title="9. Sharing & Disclosure" icon={Scale}>
                        <p className="mb-4">We do not sell your personal data. Ever. We share aggregated, non-personal data for open civic datasets licensed under ODbL.</p>
                        <ul className="text-sm space-y-2 opacity-80">
                            <li>• <strong>Vercel:</strong> Infrastructure provider (standard traffic logs).</li>
                            <li>• <strong>Legal:</strong> Only by valid, binding court order under Kenyan law.</li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection id="s10" title="10. Third-Party Services" icon={Server}>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="font-bold">Vercel</span>
                                <span className="opacity-60">Web Hosting & CDN</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="font-bold">OpenStreetMap</span>
                                <span className="opacity-60">Map Tile Delivery</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="font-bold">Google Fonts</span>
                                <span className="opacity-60">Typography (DM Sans)</span>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s11" title="11. Security Standards" icon={Lock}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold mb-2">TLS 1.3</h4>
                                <p className="text-sm opacity-80">All communication is encrypted. We enforce HSTS and reject HTTP connections.</p>
                            </div>
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold mb-2">Sandbox</h4>
                                <p className="text-sm opacity-80">Local data is isolated via browser same-origin policy and Content Security Policy (CSP).</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s12" title="12. Data Retention" icon={Trash2}>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span>API Access Logs</span>
                                <span className="font-bold">30 Days</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span>Crash Reports</span>
                                <span className="font-bold">14 Days</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span>Verified Reports</span>
                                <span className="font-bold">Indefinite (Dataset)</span>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s13" title="13. Your Rights" icon={UserCheck}>
                        <p className="mb-4">Under the Kenya Data Protection Act 2019, you have the following rights:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <span className="p-2 rounded-lg bg-blue-500/10">Right to Access</span>
                            <span className="p-2 rounded-lg bg-blue-500/10">Right to Correction</span>
                            <span className="p-2 rounded-lg bg-blue-500/10">Right to Erasure</span>
                            <span className="p-2 rounded-lg bg-blue-500/10">Right to Data Portability</span>
                        </div>
                        <p className="mt-4 text-xs opacity-60">To exercise these, email <strong>civiceducationkenya@gmail.com</strong>.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="s14" title="14. Children's Privacy" icon={Baby}>
                        <p>Nasaka is designed for voters (18+). We do not knowingly collect data from children under 18. If you believe we have inadvertently collected such data, contact us for immediate removal.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="s15" title="15. Electoral & Biometric" icon={Vote}>
                        <p className="mb-4">Nasaka recognises the sensitivity of electoral data. We collect NO biometric data and have no access to official voter registration roles.</p>
                        <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}>
                            <p className="text-xs"><strong>Anti-Surveillance commitment:</strong> We will not assist any party seeking to use Nasaka data to track or intimidate electoral workers.</p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s16" title="16. International Users" icon={Globe}>
                        <p>Regardless of where you access Nasaka, we apply Kenyan Data Protection Act standards as the baseline. Traffic may pass through Vercel's global CDN data centres.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="s17" title="17. Legal Compliance" icon={Scale}>
                        <p className="mb-2">Nasaka operates under:</p>
                        <ul className="text-sm opacity-80 grid gap-1">
                            <li>• Constitution of Kenya 2010 (Art. 31)</li>
                            <li>• Data Protection Act 2019</li>
                            <li>• Elections Act 2011</li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection id="s18" title="18. Policy Changes" icon={RefreshCcw}>
                        <p>Material changes will be notified via a 30-day notice on our homepage. Your continued use signifies acceptance of the new terms.</p>
                    </CollapsibleSection>

                    <CollapsibleSection id="s19" title="19. Contact & DPO" icon={Mail}>
                        <div className={`p-6 rounded-3xl ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-600'} text-white shadow-xl`}>
                            <h4 className="font-bold text-xl mb-2">Civic Education Kenya</h4>
                            <p className="text-sm opacity-90 mb-4">For all privacy inquiries and data rights requests.</p>
                            <div className="space-y-2 text-sm font-medium">
                                <div className="flex justify-between">
                                    <span>Email:</span>
                                    <span className="font-bold">civiceducationkenya@gmail.com</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Regulatory:</span>
                                    <span className="font-bold">odpc.go.ke</span>
                                </div>
                            </div>
                        </div>
                    </CollapsibleSection>
                </div>

                {/* Footer Disclaimer */}
                <div className="mt-16 text-center">
                    <div className="w-12 h-1 bg-blue-500/20 mx-auto mb-8 rounded-full" />
                    <p className={`text-[13px] font-medium ${theme === 'dark' ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>
                        © 2025–2026 Civic Education Kenya (CEKA).<br />
                        "Every person has the right to privacy" — Article 31, Constitution of Kenya 2010.
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

export default Privacy;
