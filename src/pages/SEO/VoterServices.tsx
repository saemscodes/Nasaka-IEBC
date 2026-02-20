import React from 'react';
import { motion } from 'framer-motion';
import {
    UserPlus,
    MapPin,
    RefreshCw,
    CheckCircle2,
    Search,
    FileText,
    ChevronRight,
    ShieldCheck,
    Calendar
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { SEOHead, generateBreadcrumbSchema, generateFAQSchema } from '@/components/SEO/SEOHead';
import { deslugify } from '@/components/SEO/SEOHead';
import { Link } from 'react-router-dom';

const VoterServices = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const services = [
        {
            title: 'Continuous Voter Registration (CVR)',
            icon: <UserPlus className="w-6 h-6 text-blue-500" />,
            description: 'Register as a voter at any IEBC constituency office during designated periods. Requires original National ID or valid Passport.',
            keywords: ['new registration', 'voter card', 'biometric capture']
        },
        {
            title: 'Transfer of Registration',
            icon: <RefreshCw className="w-6 h-6 text-green-500" />,
            description: 'Moving to a new constituency? You can transfer your voting station by visiting the IEBC office in your new area of residence.',
            keywords: ['change station', 'voter transfer', 'new polling centre']
        },
        {
            title: 'Voter Status Verification',
            icon: <ShieldCheck className="w-6 h-6 text-amber-500" />,
            description: 'Ensure your details are correctly captured in the Integrated Database Management System (IDMS).',
            keywords: ['voter register link', 'check status', 'edit particulars']
        }
    ];

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 ${isDark ? 'bg-ios-gray-900 text-white' : 'bg-ios-gray-50 text-ios-gray-900'}`}>
            <SEOHead
                title="IEBC Voter Registration & Services — CVR, Transfers, Status | Nasaka IEBC"
                description="Complete guide to IEBC voter services in Kenya. How to register to vote (CVR), transfer your polling station, and verify your details at any constituency office."
                canonical="/voter-services"
                keywords="IEBC voter registration, CVR Kenya, check voter status, transfer polling station, voter verification, IEBC office registration"
                schema={[
                    generateBreadcrumbSchema([
                        { name: 'Home', url: '/' },
                        { name: 'Voter Services', url: '/voter-services' }
                    ]),
                    generateFAQSchema([
                        {
                            question: "What documents do I need for IEBC voter registration?",
                            answer: "You must present your Original National Identity Card (ID) or a valid Kenyan Passport. Photocopies or waiting slips are not accepted."
                        },
                        {
                            question: "How do I transfer my voter registration to another constituency?",
                            answer: "Visit the IEBC constituency office where you intend to vote. You will fill out Form 7 and provide your ID for verification. The transfer is usually processed within 30 days."
                        },
                        {
                            question: "Can I register as a voter online in Kenya?",
                            answer: "Currently, the IEBC requires biometric data capture (fingerprints and facial image), which must be done in person at a registered IEBC registration centre or constituency office."
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
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/10 text-blue-500 text-sm font-bold mb-4">
                        <Calendar className="w-4 h-4 mr-2" />
                        Electoral Cycle 2022 — 2027
                    </div>
                    <h1 className="text-5xl font-black mb-6 tracking-tight">Voter Services</h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Your comprehensive guide to registration, transfers, and status verification via IEBC constituency offices.
                    </p>
                </motion.div>

                <section className="grid md:grid-cols-1 gap-6 mb-16">
                    {services.map((service, idx) => (
                        <motion.div
                            key={service.title}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`p-8 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row gap-6 items-start transition-all hover:shadow-md ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100'}`}
                        >
                            <div className={`p-4 rounded-2xl shrink-0 ${isDark ? 'bg-ios-gray-700' : 'bg-ios-gray-50'}`}>
                                {service.icon}
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold mb-3">{service.title}</h2>
                                <p className="text-muted-foreground mb-4 leading-relaxed">
                                    {service.description}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {service.keywords.map(kw => (
                                        <span key={kw} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-ios-gray-700 text-ios-gray-400' : 'bg-ios-gray-100 text-ios-gray-500'}`}>
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <ChevronRight className="w-6 h-6 text-muted-foreground opacity-30 self-center hidden md:block" />
                        </motion.div>
                    ))}
                </section>

                <section className={`p-10 rounded-[3rem] border mb-16 relative overflow-hidden ${isDark ? 'bg-ios-blue-600 shadow-ios-blue/20' : 'bg-ios-blue text-white shadow-ios-blue/25'}`}>
                    <div className="relative z-10">
                        <h2 className="text-3xl font-black mb-4">Ready to find your office?</h2>
                        <p className="text-ios-blue-100 mb-8 max-w-lg">
                            Unlock directions, opening hours, and contact details for every IEBC office in Kenya.
                        </p>
                        <Link to="/iebc-office/map" className="inline-flex items-center px-8 py-4 bg-white text-ios-blue rounded-2xl font-bold transition-transform active:scale-95 shadow-xl">
                            <MapPin className="w-5 h-5 mr-2" />
                            Open Interactive Map
                        </Link>
                    </div>
                    {/* Decorative background element */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                </section>

                <section className="mb-20">
                    <h2 className="text-3xl font-black mb-8 px-2 flex items-center gap-3">
                        <FileText className="w-8 h-8 text-ios-blue" />
                        Step-by-Step Registration
                    </h2>
                    <div className="space-y-4">
                        {[
                            { step: '1', title: 'Find your Office', desc: 'Use Nasaka to locate the constituency office where you intend to vote.' },
                            { step: '2', title: 'Prepare Documents', desc: 'Carry your Original National ID or valid Passport (Waiting slips not allowed).' },
                            { step: '3', title: 'Biometric Capture', desc: 'The IEBC official will capture your fingerprints and facial image using a BVR kit.' },
                            { step: '4', title: 'Confirmation', desc: 'Verify the details on the acknowledgment slip before signing.' }
                        ].map(item => (
                            <div key={item.step} className="flex gap-6 p-6">
                                <span className="text-4xl font-black text-ios-blue/20">{item.step}</span>
                                <div>
                                    <h3 className="text-xl font-bold mb-1">{item.title}</h3>
                                    <p className="text-muted-foreground">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default VoterServices;
