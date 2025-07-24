
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MapPin, Calendar, Users, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import PetitionDetailsModal from './PetitionDetailsModal';

interface PetitionCardProps {
  petition: {
    id: string;
    mp_name: string;
    constituency: string;
    county: string;
    grounds: string[];
    description: string;
    signature_target: number;
    current_signatures: number;
    ward_target: number;
    wards_covered: number;
    deadline: string;
    status: string;
  };
  onJoinPetition: (petitionId: string) => void;
}

const PetitionCard = ({ petition, onJoinPetition }: PetitionCardProps) => {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const progressPercentage = (petition.current_signatures / petition.signature_target) * 100;
  const wardProgress = (petition.wards_covered / petition.ward_target) * 100;
  const daysRemaining = Math.ceil((new Date(petition.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const getGroundsLabel = (grounds: string[]) => {
    const labels: { [key: string]: string } = {
      'chapter_6': 'Chapter 6 Violation',
      'funds_misuse': 'Funds Misappropriation', 
      'electoral_crime': 'Electoral Offense',
      'abuse_of_office': 'Abuse of Office',
      'corruption': 'Corruption'
    };
    return grounds.map(g => labels[g] || g);
  };

  const getGroundsColor = (ground: string) => {
    switch (ground) {
      case 'chapter_6': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'funds_misuse': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'electoral_crime': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'abuse_of_office': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      case 'corruption': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <>
      <Card className="border-2 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 transition-all bg-white dark:bg-gray-900">
        <CardHeader className="bg-gradient-to-r from-green-50/50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/20">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl text-green-900 dark:text-green-100">
                Recall Petition: {petition.mp_name}
              </CardTitle>
              <CardDescription className="flex items-center mt-2 text-green-700 dark:text-green-300">
                <MapPin className="w-4 h-4 mr-1" />
                {petition.constituency}, {petition.county}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <Badge className="bg-green-600 dark:bg-green-700 text-white">
                {petition.status.toUpperCase()}
              </Badge>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="w-4 h-4 mr-1" />
                {daysRemaining} days left
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Legal Grounds */}
          <div className="mb-4">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Legal Grounds:</h4>
            <div className="flex flex-wrap gap-2">
              {getGroundsLabel(petition.grounds).map((ground, index) => (
                <Badge key={index} className={getGroundsColor(petition.grounds[index])}>
                  {ground}
                </Badge>
              ))}
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-700 dark:text-gray-300 mb-4 text-sm leading-relaxed line-clamp-3">
            {petition.description}
          </p>

          {/* Constitutional Requirements Panel */}
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-green-700 dark:text-green-300 mb-3 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Constitutional Compliance Status
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Signature Progress */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300">Signatures Required</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {petition.current_signatures.toLocaleString()}/{petition.signature_target.toLocaleString()}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2 mb-1" />
                <p className="text-xs text-gray-600 dark:text-gray-400">(Elections Act §46)</p>
              </div>

              {/* Ward Distribution */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300">Ward Distribution</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {petition.wards_covered}/{petition.ward_target} Wards
                  </span>
                </div>
                <Progress value={wardProgress} className="h-2 mb-1" />
                <p className="text-xs text-gray-600 dark:text-gray-400">(Min. 50% of wards)</p>
              </div>
            </div>

            {/* Compliance Indicators */}
            <div className="mt-3 flex items-center space-x-4 text-xs">
              <div className="flex items-center">
                {progressPercentage >= 30 ? (
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-1" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-1" />
                )}
                <span className="text-gray-700 dark:text-gray-300">
                  30% Threshold: {progressPercentage >= 30 ? 'Met' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center">
                {wardProgress >= 50 ? (
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-1" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-1" />
                )}
                <span className="text-gray-700 dark:text-gray-300">
                  Ward Coverage: {wardProgress >= 50 ? 'Compliant' : 'Needs More'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button 
              onClick={() => setShowDetailsModal(true)}
              variant="outline" 
              className="flex-1 border-green-600 dark:border-green-400 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </Button>
            <Button 
              onClick={() => onJoinPetition(petition.id)}
              className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
            >
              <Users className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Sign Petition</span>
              <span className="sm:hidden">Sign</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <PetitionDetailsModal
        petition={petition}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
      />
    </>
  );
};

export default PetitionCard;
