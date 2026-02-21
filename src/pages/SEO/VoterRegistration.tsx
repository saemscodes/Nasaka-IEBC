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
    Calendar,
    Clock,
    Fingerprint,
    IdCard,
    Building2,
    ArrowRight,
    ExternalLink,
    Info,
    AlertCircle
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { SEOHead, generateBreadcrumbSchema, generateFAQSchema } from '@/components/SEO/SEOHead';
import { Link } from 'react-router-dom';

const fadeUp = {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
};

const stagger = {
    animate: { transition: { staggerChildren: 0.08 } }
};

const VoterRegistration = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const services = [
        {
            title: 'Continuous Voter Registration (CVR)',
            icon: <UserPlus className="w-6 h-6 text-ios-blue" />,
            description: 'Register as a voter at any IEBC constituency office during designated periods. Requires original National ID or valid Passport.',
            keywords: ['new registration', 'voter card', 'biometric capture'],
            color: 'ios-blue'
        },
        {
            title: 'Transfer of Registration',
            icon: <RefreshCw className="w-6 h-6 text-green-500" />,
            description: 'Moving to a new constituency? You can transfer your voting station by visiting the IEBC office in your new area of residence.',
            keywords: ['change station', 'voter transfer', 'new polling centre'],
            color: 'green-500'
        },
        {
            title: 'Voter Status Verification',
            icon: <ShieldCheck className="w-6 h-6 text-amber-500" />,
            description: 'Ensure your details are correctly captured in the Integrated Database Management System (IDMS). Verify your polling station assignment.',
            keywords: ['voter register', 'check status', 'edit particulars'],
            color: 'amber-500'
        }
    ];

    const registrationSteps = [
        {
            step: '01',
            title: 'Find Your Office',
            desc: 'Use Nasaka to locate the IEBC constituency office nearest to your area of residence. Each constituency has one designated office.',
            icon: <MapPin className="w-5 h-5" />
        },
        {
            step: '02',
            title: 'Prepare Documents',
            desc: 'Carry your Original National ID Card or valid Kenyan Passport. Photocopies, waiting slips, and digital copies are not accepted.',
            icon: <IdCard className="w-5 h-5" />
        },
        {
            step: '03',
            title: 'Biometric Capture',
            desc: 'At the office, an IEBC official will capture your fingerprints and facial image using a Biometric Voter Registration (BVR) kit.',
            icon: <Fingerprint className="w-5 h-5" />
        },
        {
            step: '04',
            title: 'Details Confirmation',
            desc: 'Review all captured details on the acknowledgment slip — your full name, ID number, polling station — and sign to confirm accuracy.',
            icon: <CheckCircle2 className="w-5 h-5" />
        }
    ];

    const requirements = [
        { label: 'Kenyan Citizen', detail: 'Must be a citizen of Kenya by birth or naturalization' },
        { label: 'Age 18+', detail: 'Must have attained the age of eighteen years on the registration date' },
        { label: 'Valid ID', detail: 'Original National Identity Card or valid Kenyan Passport required' },
        { label: 'Not Disqualified', detail: 'Must not be disqualified under Chapter 6 of the Constitution' },
        { label: 'Sound Mind', detail: 'Must be of sound mind as defined under Kenyan law' },
        { label: 'Not Convicted', detail: 'Must not have been convicted of an election offence within the preceding 5 years' }
    ];

    const faqs = [
        {
            question: "What documents do I need for IEBC voter registration?",
            answer: "You must present your Original National Identity Card (ID) or a valid Kenyan Passport. Photocopies, waiting slips, or digital copies are not accepted. The document must be valid and not expired."
        },
        {
            question: "How do I transfer my voter registration to another constituency?",
            answer: "Visit the IEBC constituency office in your new area of residence. You will fill out Form 7 (Application for Transfer of Registration) and provide your ID for verification. The transfer is processed within the current registration cycle."
        },
        {
            question: "Can I register as a voter online in Kenya?",
            answer: "No. The IEBC requires in-person biometric data capture (fingerprints and facial image), which must be done physically at a registered IEBC registration centre or constituency office. There is no online registration option."
        },
        {
            question: "How do I check if I am already registered to vote?",
            answer: "You can verify your voter registration status by visiting the IEBC's official voter register portal or by sending an SMS with your ID number to 70000. The Nasaka IEBC map can help you locate your assigned polling station."
        },
        {
            question: "What happens if my details are incorrect in the voter register?",
            answer: "Visit your local IEBC constituency office with your original ID to request a correction. The IEBC will update your details in the Integrated Database Management System (IDMS) after verification."
        },
        {
            question: "When does voter registration happen?",
            answer: "The IEBC conducts Continuous Voter Registration (CVR) during designated periods, typically announced before major elections. The next mass registration is expected ahead of the 2027 General Election. Check the IEBC website or Nasaka for updates."
        }
    ];

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 ${isDark ? 'bg-ios-gray-900 text-white' : 'bg-ios-gray-50 text-ios-gray-900'}`}>
            <SEOHead
                title="Voter Registration Kenya — How to Register, Transfer & Verify | Nasaka IEBC"
                description="Complete guide to voter registration in Kenya. Learn how to register to vote (CVR), transfer your polling station, and verify your voter status at any IEBC constituency office."
                canonical="/voter-registration"
                keywords="voter registration Kenya, how to register to vote Kenya, IEBC voter registration, CVR Kenya 2027, transfer polling station Kenya, check voter status Kenya, IEBC constituency office registration, voter card Kenya, biometric voter registration, IEBC voter services"
                schema={[
                    generateBreadcrumbSchema([
                        { name: 'Home', url: '/' },
                        { name: 'Voter Registration', url: '/voter-registration' }
                    ]),
                    generateFAQSchema(faqs)
                ]}
            />

            <div className="max-w-4xl mx-auto px-6 pt-16">
                {/* Hero */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="inline-flex items-center px-4 py-2 rounded-full bg-ios-blue/10 text-ios-blue text-sm font-bold mb-6"
                    >
                        <Calendar className="w-4 h-4 mr-2" />
                        Electoral Cycle 2022 — 2027
                    </motion.div>
                    <h1 className="text-5xl font-black mb-6 tracking-tight leading-tight">
                        Voter Registration
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        Your complete guide to registering, transferring, and verifying your voter details at any IEBC constituency office in Kenya.
                    </p>
                </motion.div>

                {/* Services Section */}
                <motion.section
                    variants={stagger}
                    initial="initial"
                    animate="animate"
                    className="grid md:grid-cols-1 gap-5 mb-16"
                >
                    {services.map((service, idx) => (
                        <motion.div
                            key={service.title}
                            variants={fadeUp}
                            className={`p-8 rounded-[2.5rem] border transition-all duration-300 hover:shadow-lg ${isDark
                                ? 'bg-ios-gray-800 border-ios-gray-700 hover:border-ios-gray-600'
                                : 'bg-white border-ios-gray-100 shadow-sm hover:shadow-md'
                                }`}
                        >
                            <div className="flex flex-col md:flex-row gap-6 items-start">
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
                            </div>
                        </motion.div>
                    ))}
                </motion.section>

                {/* Requirements Section */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-16"
                >
                    <h2 className="text-3xl font-black mb-8 px-2 flex items-center gap-3">
                        <AlertCircle className="w-8 h-8 text-amber-500" />
                        Eligibility Requirements
                    </h2>
                    <div className={`rounded-[2.5rem] border overflow-hidden ${isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm'}`}>
                        {requirements.map((req, idx) => (
                            <div
                                key={req.label}
                                className={`flex items-start gap-4 px-8 py-5 ${idx !== requirements.length - 1 ? `border-b ${isDark ? 'border-ios-gray-700' : 'border-ios-gray-100'}` : ''}`}
                            >
                                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold block">{req.label}</span>
                                    <span className="text-sm text-muted-foreground">{req.detail}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.section>

                {/* Step-by-Step Registration */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mb-16"
                >
                    <h2 className="text-3xl font-black mb-8 px-2 flex items-center gap-3">
                        <FileText className="w-8 h-8 text-ios-blue" />
                        Step-by-Step Registration
                    </h2>
                    <div className="space-y-4">
                        {registrationSteps.map((item, idx) => (
                            <motion.div
                                key={item.step}
                                initial={{ opacity: 0, x: -16 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + idx * 0.1 }}
                                className={`flex gap-6 p-6 rounded-[2rem] border transition-all duration-300 ${isDark
                                    ? 'bg-ios-gray-800 border-ios-gray-700 hover:border-ios-gray-600'
                                    : 'bg-white border-ios-gray-100 shadow-sm hover:shadow-md'
                                    }`}
                            >
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-ios-blue/20' : 'bg-ios-blue/10'}`}>
                                    <span className="text-ios-blue font-black text-lg">{item.step}</span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        {item.icon}
                                        <h3 className="text-xl font-bold">{item.title}</h3>
                                    </div>
                                    <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.section>

                {/* CTA Section */}
                <motion.section
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 }}
                    className={`p-10 rounded-[3rem] border mb-16 relative overflow-hidden ${isDark ? 'bg-ios-blue-600 shadow-ios-blue/20' : 'bg-ios-blue text-white shadow-ios-blue/25'}`}
                >
                    <div className="relative z-10">
                        <h2 className="text-3xl font-black mb-4">Ready to find your office?</h2>
                        <p className="text-ios-blue-100 mb-8 max-w-lg">
                            Locate the nearest IEBC constituency office with directions, opening hours, and contact details for every office in Kenya.
                        </p>
                        <Link
                            to="/iebc-office/map"
                            className="inline-flex items-center px-8 py-4 bg-white text-ios-blue rounded-2xl font-bold transition-all active:scale-95 shadow-xl hover:shadow-2xl hover:scale-[1.02]"
                        >
                            <MapPin className="w-5 h-5 mr-2" />
                            Open Interactive Map
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </Link>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-16 -mb-16 blur-2xl" />
                </motion.section>

                {/* FAQ Section */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="mb-20"
                >
                    <h2 className="text-3xl font-black mb-8 px-2 flex items-center gap-3">
                        <Info className="w-8 h-8 text-ios-blue" />
                        Frequently Asked Questions
                    </h2>
                    <div className={`rounded-[2.5rem] border overflow-hidden divide-y ${isDark ? 'bg-ios-gray-800 border-ios-gray-700 divide-ios-gray-700' : 'bg-white border-ios-gray-100 shadow-sm divide-ios-gray-100'}`}>
                        {faqs.map((faq, idx) => (
                            <details key={idx} className="group">
                                <summary className="flex items-center justify-between px-8 py-5 cursor-pointer list-none select-none">
                                    <h3 className="font-bold text-base pr-4">{faq.question}</h3>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-300 group-open:rotate-90" />
                                </summary>
                                <div className="px-8 pb-5">
                                    <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                                </div>
                            </details>
                        ))}
                    </div>
                </motion.section>

                {/* Important Notice */}
                <motion.section
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className={`p-8 rounded-[2.5rem] border mb-16 ${isDark ? 'bg-amber-900/20 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}
                >
                    <div className="flex items-start gap-4">
                        <AlertCircle className={`w-6 h-6 shrink-0 mt-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                        <div>
                            <h3 className={`font-bold mb-2 ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
                                Important Notice
                            </h3>
                            <p className={`text-sm leading-relaxed ${isDark ? 'text-amber-300/80' : 'text-amber-800'}`}>
                                Nasaka IEBC is an independent civic technology platform operated by Civic Education Kenya (CEKA).
                                We are not affiliated with the Independent Electoral and Boundaries Commission (IEBC) of Kenya.
                                For official IEBC services, visit <a href="https://www.iebc.or.ke" target="_blank" rel="noopener noreferrer" className="underline font-bold">iebc.or.ke</a>.
                                All data on this platform is community-verified and open source.
                            </p>
                        </div>
                    </div>
                </motion.section>
            </div>
        </div>
    );
};

export default VoterRegistration;
