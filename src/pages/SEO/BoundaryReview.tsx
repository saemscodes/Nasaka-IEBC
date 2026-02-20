import React from 'react';
import { motion } from 'framer-motion';
import {
    Milestone,
    Map as MapIcon,
    Scale,
    Info,
    ChevronRight,
    Gavel,
    History,
    TrendingUp,
    Landmark
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { SEOHead, generateBreadcrumbSchema, generateFAQSchema } from '@/components/SEO/SEOHead';
import { Link } from 'react-router-dom';

const BoundaryReview = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const timelines = [
        {
            period: '2023 — 2024',
            title: 'Preliminary Setup',
            desc: 'Creation of working committees and legal framework reviews following the 2022 General Election cycle.'
        },
        {
            period: '2025/2026',
            title: 'Review Implementation',
            desc: 'The constitutional deadline for boundary delimitation. Reviewing 290 constituencies and 1,450 wards based on census data.'
        },
        {
            period: '2027',
            title: 'New Boundaries Applied',
            desc: 'The revised boundaries will be used for the 2027 General Election cycle.'
        }
    ];

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 ${isDark ? 'bg-ios-gray-900 text-white' : 'bg-ios-gray-50 text-ios-gray-900'}`}>
            <SEOHead
                title="IEBC Boundary Review 2025/2027 — Constituency Delimitation Kenya | Nasaka IEBC"
                description="Comprehensive analysis of the IEBC boundary review process in Kenya. Learn about constituency delimitation, the 2019 census data disputes, and the 2025/2027 electoral boundary changes."
                canonical="/boundary-review"
                keywords="IEBC boundary review 2025, constituency delimitation Kenya, 290 constituencies Kenya, electoral boundaries, IEBC Amendment Bill"
                schema={[
                    generateBreadcrumbSchema([
                        { name: 'Home', url: '/' },
                        { name: 'Boundary Review', url: '/boundary-review' }
                    ]),
                    generateFAQSchema([
                        {
                            question: "When is the next IEBC boundary review in Kenya?",
                            answer: "The Constitution of Kenya requires the IEBC to review boundaries every 8 to 12 years. The current cycle is expected to conclude between 2024 and 2026, ahead of the 2027 polls."
                        },
                        {
                            question: "How many constituencies are there in Kenya?",
                            answer: "There are currently 290 constituencies and 1,450 wards. The review process may adjust these boundaries based on population quotas derived from the national census."
                        }
                    ])
                ]}
            />

            <div className="max-w-4xl mx-auto px-6 pt-16">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-amber-500/10 text-amber-500 text-sm font-bold mb-4">
                        <Scale className="w-4 h-4 mr-2" />
                        Constitutional Mandate
                    </div>
                    <h1 className="text-5xl font-black mb-6 tracking-tight">Boundary Review</h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Navigating the complex process of electoral delimitation and constituency distribution in Kenya.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-8 mb-16">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-10 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100'}`}
                    >
                        <div className="w-12 h-12 rounded-2xl bg-ios-blue/10 flex items-center justify-center mb-6">
                            <Landmark className="w-6 h-6 text-ios-blue" />
                        </div>
                        <h2 className="text-2xl font-bold mb-4">The 2024-2026 Cycle</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Section 89 of the Constitution mandates the Commission to review the names and boundaries of constituencies at intervals of not less than 8 years, and not more than 12 years.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className={`p-10 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100'}`}
                    >
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                            <TrendingUp className="w-6 h-6 text-purple-500" />
                        </div>
                        <h2 className="text-2xl font-bold mb-4">Population Quotas</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Boundaries are primarily determined by population quotas, balanced against geographical features, community of interest, and socio-economic ties.
                        </p>
                    </motion.div>
                </div>

                <section className="mb-16">
                    <h2 className="text-3xl font-black mb-10 px-2 flex items-center gap-3">
                        <History className="w-8 h-8 text-ios-blue" />
                        Review Timeline
                    </h2>
                    <div className="relative border-l-2 border-ios-gray-200 dark:border-ios-gray-800 ml-4 space-y-12">
                        {timelines.map((item, idx) => (
                            <div key={item.title} className="relative pl-10">
                                <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 ${isDark ? 'bg-ios-gray-900 border-ios-blue' : 'bg-white border-ios-blue'}`} />
                                <span className="text-sm font-black text-ios-blue mb-2 block tracking-widest uppercase">
                                    {item.period}
                                </span>
                                <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                                <p className="text-muted-foreground leading-relaxed max-w-xl">
                                    {item.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={`p-10 rounded-[3rem] border mb-16 relative overflow-hidden flex flex-col items-center text-center ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-ios-gray-50 border-ios-gray-200'}`}>
                    <div className="w-16 h-16 rounded-full bg-ios-blue flex items-center justify-center mb-6 shadow-xl shadow-ios-blue/20">
                        <MapIcon className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-black mb-4">Explore Current Boundaries</h2>
                    <p className="text-muted-foreground mb-8 max-w-md">
                        View existing constituency and ward boundaries on our high-resolution interactive map.
                    </p>
                    <Link to="/iebc-office/map" className="inline-flex items-center px-10 py-5 bg-ios-blue text-white rounded-2xl font-bold transition-transform active:scale-95 shadow-lg shadow-ios-blue/25">
                        Show Map Layers
                    </Link>
                </section>

                <section className="mb-20">
                    <div className={`p-8 rounded-[2rem] ${isDark ? 'bg-red-500/5' : 'bg-red-50'}`}>
                        <div className="flex gap-4 items-start">
                            <Gavel className="w-8 h-8 text-red-500 shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-bold mb-2">Legal Challenges</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    The boundary review process is often subject to intense legal scrutiny and public hearings. Key issues include the use of the 2019 National Census data and the "Nadco" (National Dialogue Committee) reports influencing election laws.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default BoundaryReview;
