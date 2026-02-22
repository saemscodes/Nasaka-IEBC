import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ArrowLeft, Ban, Shield, Scale, Database, Lock as LockIcon,
    FileText, Globe as GlobeIcon, Target, EyeOff, LayoutGrid,
    Cookie, Share2, Server, Trash2, UserCheck, Baby, Vote,
    RefreshCcw, Mail
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
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

                    <Link
                        to="/iebc-office/terms"
                        className={`mt-8 inline-flex items-center space-x-2 px-6 py-3 rounded-full border transition-all duration-300 ${theme === 'dark'
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                            : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                            } text-[15px] font-bold shadow-lg backdrop-blur-md`}
                    >
                        <Scale size={18} strokeWidth={2.5} />
                        <span>View Service Terms</span>
                    </Link>
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
                    <CollapsibleSection id="s1" title="1. Who We Are & Scope" icon={GlobeIcon}>
                        <p className="mb-4">
                            <strong>Nasaka IEBC</strong> (operating at <em>recall254.vercel.app</em>) is an independent civic technology platform developed and maintained by <strong>Civic Education Kenya (CEKA)</strong>, a non-governmental civic education organisation registered in the Republic of Kenya.
                        </p>
                        <p className="mb-4">
                            This Privacy Policy applies to all users of the Nasaka platform, including its web application, Progressive Web App (PWA), developer API, open dataset, and any associated community or verification workflows. It explains what information we collect, why we collect it, how we use and protect it, and what rights you have over your data.
                        </p>
                        <p className="mb-4">
                            Nasaka is an <strong>independent civic resource</strong>. We are not affiliated with, endorsed by, or acting as an agent of the Independent Electoral and Boundaries Commission (IEBC) of Kenya. We merely aggregate and present publicly available IEBC constituency office information to help citizens.
                        </p>
                        <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
                            <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                                <strong>Who this policy protects:</strong> This policy applies to every visitor, registered user, API developer, community contributor, and volunteer verifier who interacts with Nasaka in any capacity, whether you are based in Kenya or accessing from abroad.
                            </p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s2" title="2. Zero-Persistence Privacy" icon={Target}>
                        <p className="mb-4">
                            Nasaka is built on the principle of <strong>Zero-Persistence Privacy</strong>: civic tools should empower citizens without monitoring them. We believe you should be able to find your IEBC office, check registration details, and navigate to polling stations without leaving a personal data trail.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold mb-2 text-blue-500">Local-First Processing</h4>
                                <p className="text-sm opacity-80">Your GPS coordinates and search queries are processed exclusively on your device. We do not transmit your live location to our servers at any time.</p>
                            </div>
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold mb-2 text-blue-500">No Behavioural Profiling</h4>
                                <p className="text-sm opacity-80">We do not build profiles based on your usage patterns, browsing history, or political interests. Your civic activity is your own.</p>
                            </div>
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold mb-2 text-blue-500">No Advertising Monetisation</h4>
                                <p className="text-sm opacity-80">We do not sell advertising. Your data is never sold, rented, or traded to commercial entities, political campaigns, or data brokers.</p>
                            </div>
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold mb-2 text-blue-500">Offline Capable</h4>
                                <p className="text-sm opacity-80">Our PWA caches maps and office data locally. Once loaded, core functions work entirely offline — no server communication needed.</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s3" title="3. Information We Collect" icon={Database}>
                        <p className="mb-4 text-sm opacity-80">A transparent, exhaustive list of every category of data that may be collected:</p>
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                            <table className="w-full text-left text-sm">
                                <thead className={`opacity-50 text-[10px] uppercase tracking-widest font-bold ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                    <tr>
                                        <th className="p-3 pr-4">Category</th>
                                        <th className="p-3 pr-4">What Is Collected</th>
                                        <th className="p-3 pr-4">Method</th>
                                        <th className="p-3">Store</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    <tr>
                                        <td className="p-3 pr-4 font-semibold text-blue-500">Location</td>
                                        <td className="p-3 pr-4">GPS coordinates (latitude & longitude)</td>
                                        <td className="p-3 pr-4 text-xs">Geolocation API</td>
                                        <td className="p-3 text-xs">Device only</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 pr-4 font-semibold text-blue-500">Searches</td>
                                        <td className="p-3 pr-4">County, constituency, or office searched</td>
                                        <td className="p-3 pr-4 text-xs">User input</td>
                                        <td className="p-3 text-xs">Device only</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 pr-4 font-semibold text-blue-500">Cache</td>
                                        <td className="p-3 pr-4">IEBC office metadata for offline use</td>
                                        <td className="p-3 pr-4 text-xs">PWA Worker</td>
                                        <td className="p-3 text-xs">Device only</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 pr-4 font-semibold text-blue-500">Reports</td>
                                        <td className="p-3 pr-4">Verification notes, photos, optional contact info</td>
                                        <td className="p-3 pr-4 text-xs">Voluntary form</td>
                                        <td className="p-3 text-xs">Servers</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 pr-4 font-semibold text-blue-500">Analytics</td>
                                        <td className="p-3 pr-4">Aggregated feature usage counts</td>
                                        <td className="p-3 pr-4 text-xs">Privacy-first stats</td>
                                        <td className="p-3 text-xs">Aggregate only</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 pr-4 font-semibold text-blue-500">API Logs</td>
                                        <td className="p-3 pr-4">IP, endpoint called, timestamp (for rate limits)</td>
                                        <td className="p-3 pr-4 text-xs">Access log</td>
                                        <td className="p-3 text-xs">Purged in 30d</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s4" title="4. How We Use Information" icon={FileText}>
                        <p className="mb-4">The specific, limited purposes for which we process data we collect:</p>
                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <span><strong>Nearest office calculation:</strong> Location coordinates are used solely to calculate distance to IEBC offices and display the closest ones on the map. This computation happens on your device.</span>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <span><strong>Offline access:</strong> Cached office data is stored locally to make the app function without an internet connection, critical for users in rural Kenya with limited connectivity.</span>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <span><strong>Dataset accuracy improvement:</strong> Verification reports from the community are reviewed by our team and used to update incorrect or outdated IEBC office listings.</span>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <span><strong>Platform performance monitoring:</strong> Anonymised analytics and crash reports allow us to identify broken features and make improvements without profiling individual users.</span>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <span><strong>API rate limiting and abuse prevention:</strong> API access logs are used to enforce fair-use limits and prevent scraping or denial-of-service attacks on the registry.</span>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <span><strong>Communication:</strong> Contact information submitted voluntarily is used solely to respond to your inquiry or coordinate verification contributions.</span>
                            </li>
                        </ul>
                        <div className={`mt-6 p-4 rounded-xl ${theme === 'dark' ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-100'}`}>
                            <p className={`text-xs ${theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>
                                <strong>Lawful basis for processing (Kenya Data Protection Act 2019, Section 30):</strong> Our processing is grounded on: (a) explicit consent for location access; (b) legitimate interest in maintaining an accurate civic dataset; (c) legal obligation for compliance; and (d) performance of a requested service.
                            </p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s5" title="5. We Do NOT Collect" icon={EyeOff}>
                        <div className={`p-4 rounded-xl mb-6 ${theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-100'}`}>
                            <p className={`text-sm ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>
                                <strong>Voter Privacy Absolute Guarantee:</strong> Nasaka does not link, correlate, or attempt to determine your voter registration status based on any data you provide. We are a location service — we do not know if you are registered, where you are registered, or how you vote.
                            </p>
                        </div>
                        <p className="mb-4 text-[15px] opacity-80">Data we have designed our platform never to touch:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                'National ID Number',
                                'Voter Registration Number',
                                'Biometric data (fingerprints, iris, etc.)',
                                'Financial information (M-Pesa, bank)',
                                'Political affiliation',
                                'Voting preference',
                                'Persistent identity tracking',
                                "Children's data (under 18)",
                                'Third-party social data'
                            ].map((item, i) => (
                                <div key={i} className={`flex items-center space-x-3 p-3 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                    <Ban size={14} className="text-red-500" />
                                    <span className="text-sm font-medium">{item}</span>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s6" title="6. Local Processing & Edge Computing" icon={LayoutGrid}>
                        <p className="mb-4">Nasaka is designed to run entirely within your browser or device. This architecture choice protects your privacy by default.</p>
                        <div className="space-y-3">
                            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold text-sm mb-1 text-blue-500">How to clear data</h4>
                                <p className="text-xs opacity-70">Delete all locally-stored Nasaka data by clearing your browser's cache and site data (Settings → Privacy → Clear browsing data → Site data).</p>
                            </div>
                            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold text-sm mb-1 text-blue-500">Offline Privacy</h4>
                                <p className="text-xs opacity-70">Since data is cached locally, no server is notified when you browse the map while offline. Your search intent remains private to your device.</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s7" title="7. Cookies & Tracking Technologies" icon={Cookie}>
                        <div className={`p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
                            <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                                <strong>No Advertising Cookies:</strong> Nasaka does not use Google AdSense, Facebook Pixel, or any advertising tracking technology.
                            </p>
                        </div>
                        <p className="text-sm opacity-80 mb-4">Tracking technologies we use for platform stability and performance:</p>
                        <div className="space-y-4">
                            <div className="flex gap-4 p-3 rounded-xl border border-white/5">
                                <div className="p-2 bg-blue-500/10 rounded-lg h-fit text-blue-500"><LayoutGrid size={16} /></div>
                                <div>
                                    <h5 className="text-sm font-bold">LocalStorage</h5>
                                    <p className="text-xs opacity-60">To remember your preferred theme (light/dark) and recent searches for a better UX.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 p-3 rounded-xl border border-white/5">
                                <div className="p-2 bg-blue-500/10 rounded-lg h-fit text-blue-500"><Server size={16} /></div>
                                <div>
                                    <h5 className="text-sm font-bold">Service Worker Cache</h5>
                                    <p className="text-xs opacity-60">To store IEBC office metadata for offline functionality, ensuring the app works in low-connectivity areas.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 p-3 rounded-xl border border-white/5">
                                <div className="p-2 bg-blue-500/10 rounded-lg h-fit text-blue-500"><Target size={16} /></div>
                                <div>
                                    <h5 className="text-sm font-bold">Privacy-first Analytics</h5>
                                    <p className="text-xs opacity-60">Anonymised, aggregate analytics to count active users without identifying individuals or tracking them across other websites.</p>
                                </div>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s8" title="8. Community Contributions & Verification" icon={Share2}>
                        <p className="mb-4">Verification reports from the community are reviewed by our team. We minimize data collection here, requesting only what is needed to validate your report.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-xl border border-white/10 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h5 className="font-bold text-sm mb-1">Photo Policy</h5>
                                <p className="text-xs opacity-70">We automatically strip EXIF metadata (including GPS coordinates) from uploaded photos to protect your home privacy.</p>
                            </div>
                            <div className={`p-4 rounded-xl border border-white/10 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h5 className="font-bold text-sm mb-1 text-blue-500">Anonymity</h5>
                                <p className="text-xs opacity-70">You can submit reports anonymously. If you provide contact info, it is used only for clarification and is never published.</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s9" title="9. Data Sharing & Third-Party Disclosure" icon={Scale}>
                        <p className="mb-4">We do not sell your personal data. Ever. We believe data sovereignty is a right, not a commodity.</p>
                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold">Open Datasets</h5>
                                    <p className="text-xs opacity-70">Verified office locations (geographic and administrative data) are shared under the Open Database License (ODbL) as a public civic good. This contains no personal data.</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold">Infrastructure Providers</h5>
                                    <p className="text-xs opacity-70">Vercel (our host) collects standard traffic logs (IP addresses, user agents) for security, bot detection, and CDN routing as part of their standard operations.</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold">Legal Compliance</h5>
                                    <p className="text-xs opacity-70">We only disclose data if required by a valid, binding court order under the Laws of Kenya. We will notify users of such requests unless legally prohibited.</p>
                                </div>
                            </li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection id="s10" title="10. Third-Party Service Providers" icon={Server}>
                        <p className="mb-4 text-sm opacity-80">We use a limited number of subprocessors to deliver our services:</p>
                        <div className="space-y-3">
                            {[
                                { name: 'Vercel', use: 'Web Hosting & Global CDN', privacy: 'Security logs only' },
                                { name: 'OpenStreetMap', use: 'Map Tile Delivery', privacy: 'View standard IP metadata' },
                                { name: 'Google Fonts', use: 'Typography (DM Sans)', privacy: 'Request metadata logs' },
                                { name: 'Lucide', use: 'User Interface Icons', privacy: 'Client-side only (No logs)' }
                            ].map((s, i) => (
                                <div key={i} className="flex justify-between items-center p-3 rounded-xl border border-white/5 text-xs">
                                    <div>
                                        <div className="font-bold">{s.name}</div>
                                        <div className="opacity-50">{s.use}</div>
                                    </div>
                                    <div className="text-blue-500 font-medium">{s.privacy}</div>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s11" title="11. Security Standards & Encryption" icon={LockIcon}>
                        <p className="mb-4">We implement industry-standard security measures to protect your data:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold mb-2 text-blue-500">TLS 1.3</h4>
                                <p className="text-sm opacity-80">All communication between your device and our servers is encrypted using modern protocols. We enforce HSTS and reject HTTP connections.</p>
                            </div>
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold mb-2 text-blue-500">Secure Sandbox</h4>
                                <p className="text-sm opacity-80">Local data is isolated via browser same-origin policy and a strict Content Security Policy (CSP) that prevents unauthorized code execution.</p>
                            </div>
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold mb-2 text-blue-500">Zero Access</h4>
                                <p className="text-sm opacity-80">CEKA staff cannot access your local device storage where GPS data and search history are kept. Your device is your vault.</p>
                            </div>
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h4 className="font-bold mb-2 text-blue-500">Audit Ready</h4>
                                <p className="text-sm opacity-80">Our code architecture is designed for transparency. We follow secure coding practices to mitigate OWASP Top 10 vulnerabilities.</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s12" title="12. Data Retention & Purging Policy" icon={Trash2}>
                        <p className="mb-4 text-sm opacity-80">We only keep data for as long as is strictly necessary for its intended purpose:</p>
                        <div className="space-y-2 text-sm">
                            {[
                                { item: 'Search & Location Data', age: '0 Days', detail: 'Processed locally and discarded immediately' },
                                { item: 'API Access Logs', age: '30 Days', detail: 'Purged automatically after security review' },
                                { item: 'Community Reports', age: 'Indefinite', detail: 'Maintained as part of the public verified dataset' },
                                { item: 'Support Emails', age: '12 Months', detail: 'Retained for service context, then archived' },
                                { item: 'Anonymised Analytics', age: '24 Months', detail: 'Aggregate growth trends with no personal links' }
                            ].map((r, i) => (
                                <div key={i} className="p-3 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold">{r.item}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.age === '0 Days' ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-500'}`}>{r.age}</span>
                                    </div>
                                    <div className="text-xs opacity-50">{r.detail}</div>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s13" title="13. Your Rights & Data Sovereignty" icon={UserCheck}>
                        <p className="mb-4">Under the Kenya Data Protection Act 2019, you have the following fundamental rights regarding your personal data:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                            {[
                                { title: 'Right to be Informed', desc: 'Know why and how your data is used' },
                                { title: 'Right to Access', desc: 'Request a copy of your personal data' },
                                { title: 'Right to Correction', desc: 'Fix inaccurate or incomplete data' },
                                { title: 'Right to Erasure', desc: 'Request data deletion (Right to be Forgotten)' },
                                { title: 'Right to Object', desc: 'Oppose processing for specific purposes' },
                                { title: 'Right to Portability', desc: 'Receive your data in readable format' }
                            ].map((r, i) => (
                                <div key={i} className={`p-3 rounded-xl border border-white/5 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                    <div className="text-sm font-bold text-blue-500 mb-1">{r.title}</div>
                                    <div className="text-xs opacity-60">{r.desc}</div>
                                </div>
                            ))}
                        </div>
                        <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-600'} text-white`}>
                            <h5 className="font-bold text-sm mb-1">How to exercise your rights</h5>
                            <p className="text-xs opacity-90 mb-2">Email our privacy team at <strong>contact@civiceducationkenya.com</strong> with the subject line "Data Rights Request". We respond to all verified requests within 30 days as required by law.</p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s14" title="14. Children's Privacy & Educational Use" icon={Baby}>
                        <p className="mb-4">Nasaka is designed for voters and secondary school students engaged in civic education (ages 13+). We do not knowingly collect personal data from children under 13 years of age.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-xl border border-white/10 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h5 className="font-bold text-sm mb-1">Parental Guidance</h5>
                                <p className="text-xs opacity-70">If you are between 13 and 17, we recommend using Nasaka with parental or teacher guidance for safety and context.</p>
                            </div>
                            <div className={`p-4 rounded-xl border border-white/10 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                                <h5 className="font-bold text-sm mb-1 text-red-500">Immediate Removal</h5>
                                <p className="text-xs opacity-70">If we discover we have inadvertently collected data from a child under 13, we will purge it from our systems immediately.</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s15" title="15. Electoral Safety & Biometric Data" icon={Vote}>
                        <p className="mb-4">We recognise the extreme sensitivity of electoral data in Kenya's democratic process. Our privacy architecture is designed for safety.</p>
                        <ul className="space-y-4 mb-6">
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold">No Biometric Data</h5>
                                    <p className="text-xs opacity-70">Nasaka does not collect, request, or process fingerprints, iris scans, facial recognition data, or any other biometric identifiers.</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold">No Official Registration Roles</h5>
                                    <p className="text-xs opacity-70">We do not have access to, nor do we host, the official IEBC Register of Voters. We cannot confirm your registration status.</p>
                                </div>
                            </li>
                        </ul>
                        <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}>
                            <p className="text-xs font-bold text-red-500 mb-1">Anti-Surveillance Commitment</p>
                            <p className="text-xs opacity-70">We will not facilitate any attempt by third parties to use Nasaka data to track, monitor, or intimidate electoral officials, voters, or observers. We reject all requests for bulk data profiling.</p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s16" title="16. International Users & Data Transfers" icon={GlobeIcon}>
                        <p className="mb-4">Nasaka is hosted on Vercel's global infrastructure. By using the platform, you acknowledge that your data (primarily aggregate traffic logs) may be processed in data centres located outside of Kenya (e.g., USA, EU).</p>
                        <div className={`p-4 rounded-xl border border-blue-500/20 ${theme === 'dark' ? 'bg-blue-500/5' : 'bg-blue-50'}`}>
                            <p className="text-xs italic">Regardless of where you access Nasaka, we apply the <strong>Kenya Data Protection Act 2019</strong> standards as our global privacy baseline, ensuring a high level of protection for all users.</p>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s17" title="17. Legal Compliance & Governance" icon={Scale}>
                        <p className="mb-4">Nasaka operates in strict compliance with the legal framework of the Republic of Kenya:</p>
                        <div className="space-y-3">
                            <div className="p-3 rounded-xl border border-white/5">
                                <h5 className="text-sm font-bold">The Constitution of Kenya 2010</h5>
                                <p className="text-xs opacity-60">Upholding Article 31, which guarantees every citizen the right to privacy.</p>
                            </div>
                            <div className="p-3 rounded-xl border border-white/5">
                                <h5 className="text-sm font-bold">Data Protection Act 2019</h5>
                                <p className="text-xs opacity-60">The primary legislation governing the collection and processing of personal data.</p>
                            </div>
                            <div className="p-3 rounded-xl border border-white/5">
                                <h5 className="text-sm font-bold">Elections Act 2011</h5>
                                <p className="text-xs opacity-60">Governing electoral conduct and the handling of election-related information.</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection id="s18" title="18. Policy Changes & Notifications" icon={RefreshCcw}>
                        <p className="mb-4">We may update this policy periodically to reflect changes in our technology or legal requirements.</p>
                        <ul className="space-y-3">
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <p className="text-sm opacity-80"><strong>30-Day Notice:</strong> For material changes, we will provide a clear notice on our homepage 30 days before the new policy takes effect.</p>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <p className="text-sm opacity-80"><strong>Version Archive:</strong> We maintain an archive of previous policy versions for transparency and user review.</p>
                            </li>
                        </ul>
                    </CollapsibleSection>

                    <CollapsibleSection id="s19" title="19. Contact Information & DPO" icon={Mail}>
                        <div className={`p-6 rounded-3xl ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-600'} text-white shadow-xl mb-6`}>
                            <h4 className="font-bold text-xl mb-1">Civic Education Kenya (CEKA)</h4>
                            <p className="text-sm opacity-90 mb-4">Official Data Rights & Privacy Inquiries</p>
                            <div className="space-y-3 text-sm font-medium">
                                <div className="flex justify-between items-center border-b border-white/20 pb-2">
                                    <span>Support Email</span>
                                    <span className="font-bold">contact@civiceducationkenya.com</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/20 pb-2">
                                    <span>DPO Office</span>
                                    <span className="font-bold">dpo@civiceducationkenya.com</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>Regulatory Help</span>
                                    <span className="font-bold">odpc.go.ke</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs opacity-60 text-center italic">"We are committed to responding to all legitimate privacy inquiries within 48 business hours."</p>
                    </CollapsibleSection>
                </div>

                {/* Footer Disclaimer */}
                <div className="mt-16 text-center">
                    <div className="w-12 h-1 bg-blue-500/20 mx-auto mb-8 rounded-full" />
                    <p className={`text-[13px] font-semibold tracking-wide ${theme === 'dark' ? 'text-ios-gray-400' : 'text-ios-gray-600'}`}>
                        {new Date().getFullYear()} © <a href="https://civiceducationkenya.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 underline decoration-blue-500/30 transition-colors">Civic Education Kenya (CEKA)</a>.<br />
                        <span className="opacity-60 font-medium italic">"Every person has the right to privacy" — Article 31, Constitution of Kenya 2010.</span>
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
