import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Building2, X } from 'lucide-react';

interface LocationData {
  id: number;
  name: string;
  type: 'county' | 'constituency' | 'ward';
  member_of_parliament?: string;
  registration_target?: number;
  total_voters?: number;
  governor?: string;
  senator?: string;
  county?: string;
  constituency?: string;
}

interface LocationDetailViewerProps {
  location: LocationData | null;
  isOpen: boolean;
  onClose: () => void;
}

const LocationDetailViewer: React.FC<LocationDetailViewerProps> = ({
  location,
  isOpen,
  onClose
}) => {
  if (!isOpen || !location) return null;

  const getLocationIcon = () => {
    switch (location.type) {
      case 'county':
        return <MapPin className="w-5 h-5" />;
      case 'constituency':
        return <Building2 className="w-5 h-5" />;
      case 'ward':
        return <Users className="w-5 h-5" />;
      default:
        return <MapPin className="w-5 h-5" />;
    }
  };

  const getLocationTypeColor = () => {
    switch (location.type) {
      case 'county':
        return 'bg-blue-500 text-white';
      case 'constituency':
        return 'bg-green-500 text-white';
      case 'ward':
        return 'bg-purple-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 shadow-2xl animate-scale-in">
        <CardHeader className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${getLocationTypeColor()}`}>
                {getLocationIcon()}
              </div>
              <div>
                <Badge variant="outline" className="mb-2">
                  {location.type.charAt(0).toUpperCase() + location.type.slice(1)}
                </Badge>
                <CardTitle className="text-xl text-gray-900 dark:text-white">
                  {location.name}
                </CardTitle>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Location Hierarchy */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {location.county && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">County</h4>
                <p className="text-blue-700 dark:text-blue-300">{location.county}</p>
              </div>
            )}
            
            {location.constituency && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-1">Constituency</h4>
                <p className="text-green-700 dark:text-green-300">{location.constituency}</p>
              </div>
            )}
            
            {location.type === 'ward' && (
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">Ward</h4>
                <p className="text-purple-700 dark:text-purple-300">{location.name}</p>
              </div>
            )}
          </div>

          {/* Key Statistics */}
          <div className="grid grid-cols-2 gap-4">
            {location.registration_target && (
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200">Registration Target</h4>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {location.registration_target.toLocaleString()}
                </p>
              </div>
            )}
            
            {location.total_voters && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <h4 className="font-semibold text-green-800 dark:text-green-200">Total Voters</h4>
                </div>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {location.total_voters.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Leadership Information */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Leadership
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {location.member_of_parliament && (
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                  <h5 className="font-semibold text-green-800 dark:text-green-200 mb-1">
                    Member of Parliament
                  </h5>
                  <p className="text-green-700 dark:text-green-300 font-medium">
                    {location.member_of_parliament}
                  </p>
                </div>
              )}
              
              {location.governor && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h5 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                    Governor
                  </h5>
                  <p className="text-blue-700 dark:text-blue-300 font-medium">
                    {location.governor}
                  </p>
                </div>
              )}
              
              {location.senator && (
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                  <h5 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">
                    Senator
                  </h5>
                  <p className="text-purple-700 dark:text-purple-300 font-medium">
                    {location.senator}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {location.member_of_parliament && (
              <Button className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white">
                View Related Petitions
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationDetailViewer;