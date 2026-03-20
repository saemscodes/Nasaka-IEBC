import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Lock, Activity, CheckCircle2, AlertCircle } from 'lucide-react';

interface AdminVerificationProps {
  onVerified: () => void;
}

const AdminVerification: React.FC<AdminVerificationProps> = ({ onVerified }) => {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const steps = [
    { id: 'session', label: 'Initializing Security Protocol', icon: Shield, color: 'text-blue-500' },
    { id: 'identity', label: 'Verifying Admin Identity', icon: Lock, iconColor: 'text-indigo-500' },
    { id: 'tunnel', label: 'Establishing Encrypted Tunnel', icon: Activity, iconColor: 'text-emerald-500' },
    { id: 'finalize', label: 'Finalizing Governance Access', icon: CheckCircle2, iconColor: 'text-blue-600' }
  ];

  useEffect(() => {
    let isMounted = true;

    const runVerification = async () => {
      try {
        // Step 1: Check Session
        setStep(0);
        await new Promise(r => setTimeout(r, 1200));
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Security session expired.');

        // Step 2: Verify Identity (Admin check)
        if (isMounted) setStep(1);
        await new Promise(r => setTimeout(r, 1500));
        const { data: coreTeam, error: coreError } = await supabase
          .from('core_team')
          .select('is_admin')
          .eq('user_id', session.user.id)
          .eq('is_admin', true)
          .single();

        if (coreError || !coreTeam) throw new Error('Admin authorization failed.');

        // Step 3: Tunnel/Environment check
        if (isMounted) setStep(2);
        await new Promise(r => setTimeout(r, 1000));

        // Step 4: Finalize
        if (isMounted) setStep(3);
        await new Promise(r => setTimeout(r, 800));

        if (isMounted) {
          onVerified();
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Verification failed.');
          setTimeout(() => {
            supabase.auth.signOut();
            navigate('/admin');
          }, 3000);
        }
      }
    };

    runVerification();
    return () => { isMounted = false; };
  }, [navigate, onVerified]);

  return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.div
              animate={{
                rotateY: [0, 360],
                boxShadow: ["0 0 20px rgba(59, 130, 246, 0.2)", "0 0 40px rgba(59, 130, 246, 0.4)", "0 0 20px rgba(59, 130, 246, 0.2)"]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-20 bg-[#007AFF] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#007AFF]/20"
            >
              <Shield className="w-10 h-10 text-white" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Security Buffer</h2>
            <p className="text-gray-400 font-medium">Conducting final administrative handshake...</p>
          </div>

          {/* Steps Sequence */}
          <div className="space-y-6 relative">
            {/* Connection Line */}
            <div className="absolute left-[27px] top-4 bottom-4 w-[2px] bg-white/5 z-0"></div>

            <AnimatePresence mode="popLayout">
              {steps.map((s, idx) => {
                const isActive = step === idx;
                const isCompleted = step > idx;
                const Icon = s.icon;

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{
                      opacity: isActive || isCompleted ? 1 : 0.3,
                      x: 0,
                      scale: isActive ? 1.02 : 1
                    }}
                    className="flex items-center space-x-4 relative z-10"
                  >
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-blue-600/20 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' :
                      isCompleted ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-white/5 border border-white/5'
                      }`}>
                      <Icon className={`w-6 h-6 ${isActive ? 'text-blue-400 animate-pulse' :
                        isCompleted ? 'text-emerald-400' : 'text-gray-500'
                        }`} />
                    </div>
                    <div>
                      <h3 className={`text-md font-semibold transition-colors duration-300 ${isActive ? 'text-blue-400' : isCompleted ? 'text-emerald-400' : 'text-gray-500'
                        }`}>
                        {s.label}
                      </h3>
                      {isActive && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          className="h-[2px] bg-blue-500/30 mt-1 rounded-full"
                          transition={{ duration: 1.5 }}
                        />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Footer Status */}
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center">
            {error ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center space-x-2 text-red-400 bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20"
              >
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">{error}</span>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="flex space-x-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{
                        opacity: [0.3, 1, 0.3],
                        scale: [1, 1.2, 1]
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2
                      }}
                      className="w-1.5 h-1.5 bg-blue-500 rounded-full"
                    />
                  ))}
                </div>
                <p className="text-xs text-blue-400/60 uppercase tracking-widest font-black">
                  Encrypted Nexus Active
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Decorative elements */}
        <div className="mt-8 text-center text-white/20 text-[10px] tracking-widest uppercase font-bold">
          Civic Education Kenya • Administrative Grid System
        </div>
      </motion.div>
    </div>
  );
};

export default AdminVerification;
