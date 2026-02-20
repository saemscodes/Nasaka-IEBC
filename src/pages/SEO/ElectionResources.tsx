import React from 'react';
import { motion } from 'framer-motion';
import {
    FileText,
    BarChart3,
    ShieldCheck,
    HelpCircle,
    ChevronRight,
    ExternalLink,
    BookOpen,
    PieChart,
    ClipboardCheck
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { SEOHead, generateBreadcrumbSchema, generateFAQSchema } from '@/components/SEO/SEOHead';
import { Link } from 'react-router-dom';

const ElectionResources = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const resourceSections = [
        {
            title: 'Election Forms Guide',
            icon: <FileText className="w-6 h-6 text-ios-blue" />,
            items: [
                { name: 'Form 34A', desc: 'Used for presidential results at the polling station level.' },
                { name: 'Form 34B', desc: 'Used for tallying presidential results at the constituency level.' },
                { name: 'Form 35', desc: 'Used for Member of National Assembly results.' }
            ]
        },
        {
            title: 'Technology & Results',
            icon: <BarChart3 className="w-6 h-6 text-green-500" />,
            items: [
                { name: 'RTS (Results Transmission System)', desc: 'How IEBC transmits results electronically from polling stations.' },
                { name: 'Public Portal', desc: 'Accessing official scanned forms via forms.iebc.or.ke.' }
            ]
        },
        {
            title: 'Electoral Conduct',
            icon: <ShieldCheck className="w-6 h-6 text-amber-500" />,
            items: [
                { name: 'Electoral Code of Conduct', desc: 'Revised guidelines for political parties and candidates.' },
                { name: 'Campaign Financing', desc: 'Understanding the limits and reporting requirements.' }
            ]
        }
    ];

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 ${isDark ? 'bg-ios-gray-900 text-white' : 'bg-ios-gray-50 text-ios-gray-900'}`}>
            <SEOHead
                title="IEBC Election Resources — Form 34A/B, Results Guide & Laws | Nasaka IEBC"
                description="Comprehensive guide to IEBC election resources in Kenya. Learn about Form 34A, 34B, and 35, the Results Transmission System (RTS), and electoral code of conduct for 2027."
                canonical="/election-resources"
                keywords="IEBC results portal, Form 34A, Form 34B, RTS system IEBC, Kenya election laws, 2027 General Election preparation"
                schema={[
                    generateBreadcrumbSchema([
                        { name: 'Home', url: '/' },
                        { name: 'Resources', url: '/election-resources' }
                    ]),
                    generateFAQSchema([
                        {
                            question: "What is Form 34A in Kenya elections?",
                            answer: "Form 34A is the primary document used to record results for the Presidential election at a polling station. It is signed by the Presiding Officer and party agents before being scanned and transmitted."
                        },
                        {
                            question: "How can I access the IEBC results portal?",
                            answer: "The official public portal for form inspection is typically hosted at forms.iebc.or.ke. Nasaka provides links and guides on how to navigate these official repositories."
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
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-ios-blue/10 text-ios-blue text-sm font-bold mb-4">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Knowledge Base
                    </div>
                    <h1 className="text-5xl font-black mb-6 tracking-tight">Election Resources</h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Demystifying the technical and legal frameworks of the Kenyan electoral process.
                    </p>
                </motion.div>

                <section className="grid md:grid-cols-1 gap-12 mb-20">
                    {resourceSections.map((section, idx) => (
                        <motion.div
                            key={section.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            <div className="flex items-center gap-4 mb-8">
                                <div className={`p-4 rounded-2xl ${isDark ? 'bg-ios-gray-800' : 'bg-white shadow-sm border border-ios-gray-100'}`}>
                                    {section.icon}
                                </div>
                                <h2 className="text-3xl font-black tracking-tight">{section.title}</h2>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                {section.items.map(item => (
                                    <div
                                        key={item.name}
                                        className={`p-8 rounded-[2rem] border transition-all hover:border-ios-blue ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}
                                    >
                                        <h3 className="text-xl font-bold mb-2 flex items-center justify-between">
                                            {item.name}
                                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-50" />
                                        </h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {item.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </section>

                <section className={`p-10 rounded-[3rem] border mb-16 relative overflow-hidden flex flex-col md:flex-row items-center gap-10 ${isDark ? 'bg-ios-blue-900/10 border-ios-blue-500/20' : 'bg-ios-blue/5 border-ios-blue/10'}`}>
                    <div className={`w-32 h-32 rounded-[2.5rem] shrink-0 flex items-center justify-center ${isDark ? 'bg-ios-blue-600' : 'bg-ios-blue text-white shadow-xl shadow-ios-blue/20'}`}>
                        <PieChart className="w-16 h-16" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black mb-4">Official Results Portal</h2>
                        <p className="text-muted-foreground leading-relaxed mb-6">
                            Track real-time data and access the public repository of scanned forms during election cycles.
                        </p>
                        <a
                            href="https://forms.iebc.or.ke"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-6 py-3 bg-ios-blue text-white rounded-xl font-bold transition-transform active:scale-95"
                        >
                            Visit IEBC Portal
                            <ExternalLink className="w-4 h-4 ml-2" />
                        </a>
                    </div>
                </section>

                <section className="mb-20 px-4">
                    <h2 className="text-2xl font-black mb-8 px-2 flex items-center gap-3">
                        <ClipboardCheck className="w-6 h-6 text-ios-blue" />
                        Quick Definitions
                    </h2>
                    <dl className="space-y-6">
                        {[
                            { term: 'RTS', def: 'Results Transmission System — The electronic platform for relaying results from polling stations to the central tallying centre.' },
                            { term: 'KIEMS', def: 'Kenya Integrated Election Management System — The suite of hardware and software used for voter identification and results transmission.' },
                            { term: 'RO', def: 'Returning Officer — The commission official responsible for declaring results at the constituency or county level.' }
                        ].map(item => (
                            <div key={item.term} className="border-b border-ios-gray-200 dark:border-ios-gray-800 pb-6">
                                <dt className="text-lg font-bold mb-1 text-ios-blue">{item.term}</dt>
                                <dd className="text-muted-foreground leading-relaxed">{item.def}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            </div>
        </div>
    );
};

export default ElectionResources;
