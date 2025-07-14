import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Users, Calendar, MapPin, FileText, Scale, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import EnhancedSignatureFlow from '@/components/EnhancedSignatureFlow';
import ModernHeader from '@/components/ModernHeader';
import ModernFooter from '@/components/ModernFooter';

interface Petition {
  id: string;
  mp_name: string;
  constituency: string;
  county: string;
  description: string;
  grounds: string[];
  signature_target: number;
  ward_target: number;
  deadline: string;
  status: string;
  created_at: string;
}

const SignPetition = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [petition, setPetition] = useState<Petition | null>(null);
  const [signatureCount, setSignatureCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSignatureFlow, setShowSignatureFlow] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    fetchPetition();
  }, [id]);

  useEffect(() => {
    // Check for dark mode preference
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode(!darkMode);
  };

  const scrollToTab = (tabId: string) => {
    // Not needed for this page, but required by ModernHeader
  };

  const fetchPetition = async () => {
    if (!id) return;

    try {
      setLoading(true);
      
      // Fetch petition details
      const { data: petitionData, error: petitionError } = await supabase
        .from('petitions')
        .select('*')
        .eq('id', id)
        .eq('status', 'active')
        .single();

      if (petitionError) throw petitionError;

      setPetition(petitionData);

      // Fetch signature count
      const { count, error: countError } = await supabase
        .from('signatures')
        .select('*', { count: 'exact', head: true })
        .eq('petition_id', id);

      if (countError) throw countError;

      setSignatureCount(count || 0);
    } catch (error) {
      console.error('Error fetching petition:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureComplete = () => {
    setShowSignatureFlow(false);
    fetchPetition(); // Refresh data
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white dark:from-gray-900 dark:to-gray-800">
        <ModernHeader 
          darkMode={darkMode} 
          toggleDarkMode={toggleDarkMode} 
          scrollToTab={scrollToTab} 
        />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading petition details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!petition) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white dark:from-gray-900 dark:to-gray-800">
        <ModernHeader 
          darkMode={darkMode} 
          toggleDarkMode={toggleDarkMode} 
          scrollToTab={scrollToTab} 
        />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Petition Not Found</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">The petition you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => navigate('/')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const progressPercentage = petition.signature_target ? (signatureCount / petition.signature_target) * 100 : 0;
  const daysRemaining = Math.ceil((new Date(petition.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white dark:from-gray-900 dark:to-gray-800">
      <ModernHeader 
        darkMode={darkMode} 
        toggleDarkMode={toggleDarkMode} 
        scrollToTab={scrollToTab} 
      />
      
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button 
          onClick={() => navigate('/')} 
          variant="ghost" 
          className="mb-6 text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Petitions
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Petition Header */}
            <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-white dark:from-green-900/20 dark:to-gray-800">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-green-200 dark:border-green-600 text-green-700 dark:text-green-300">
                      Recall Petition
                    </Badge>
                    <CardTitle className="text-2xl text-green-900 dark:text-green-100">
                      Recall: {petition.mp_name}
                    </CardTitle>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {petition.constituency}, {petition.county}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        Deadline: {new Date(petition.deadline).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <Badge 
                    variant={daysRemaining > 30 ? "default" : daysRemaining > 7 ? "secondary" : "destructive"}
                    className="text-xs"
                  >
                    {daysRemaining > 0 ? `${daysRemaining} days left` : 'Expired'}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Legal Grounds */}
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center text-green-900 dark:text-green-100">
                  <Scale className="w-5 h-5 mr-2" />
                  Legal Grounds for Recall
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {petition.grounds.map((ground, index) => (
                    <div key={index} className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-sm text-green-800 dark:text-green-200">{ground}</span>
                    </div>
                  ))}
                </div>
                
                <Separator className="my-4" />
                
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Petition Details</h4>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {petition.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Progress Card */}
            <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-white dark:from-green-900/20 dark:to-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center text-green-900 dark:text-green-100">
                  <Users className="w-5 h-5 mr-2" />
                  Signature Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                    {signatureCount.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    of {petition.signature_target?.toLocaleString() || 'N/A'} required signatures
                  </div>
                </div>
                
                {petition.signature_target && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                    ></div>
                  </div>
                )}
                
                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  {petition.signature_target ? Math.round(progressPercentage) : 0}% Complete
                </div>
              </CardContent>
            </Card>

            {/* Sign Petition Card */}
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center text-green-900 dark:text-green-100">
                  <FileText className="w-5 h-5 mr-2" />
                  Add Your Signature
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  By signing this petition, you are exercising your constitutional right under Article 104 
                  to hold your Member of Parliament accountable.
                </p>
                
                <Button 
                  onClick={() => setShowSignatureFlow(true)}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
                  disabled={daysRemaining <= 0}
                >
                  {daysRemaining <= 0 ? 'Petition Expired' : 'Sign This Petition'}
                </Button>
                
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <p>✓ Your signature is secured with digital certificates</p>
                  <p>✓ All data is encrypted and KICA §83C compliant</p>
                  <p>✓ Your identity will be verified but kept confidential</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Signature Flow Modal */}
        {showSignatureFlow && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Sign Petition: {petition.mp_name}
                  </h2>
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowSignatureFlow(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    ×
                  </Button>
                </div>
                
                <EnhancedSignatureFlow
                  petitionId={petition.id}
                  petitionTitle={`Recall: ${petition.mp_name}`}
                  onComplete={handleSignatureComplete}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      
      <ModernFooter />
    </div>
  );
};

export default SignPetition;