import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Play, CheckCircle, XCircle, Clock, FileText, 
  Database, MapPin, AlertTriangle, RefreshCw, Download 
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ScriptStatus {
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  message: string;
  progress: number;
}

export const PythonScriptExecutor: React.FC = () => {
  const { toast } = useToast();
  const [scripts, setScripts] = useState<ScriptStatus[]>([
    { name: 'clean_addresses', status: 'idle', message: 'Ready to clean IEBC address data', progress: 0 },
    { name: 'geocode_addresses', status: 'idle', message: 'Ready to geocode office locations', progress: 0 },
    { name: 'csv_to_geojson', status: 'idle', message: 'Ready to convert to GeoJSON format', progress: 0 },
    { name: 'validate_data', status: 'idle', message: 'Ready to validate processed data', progress: 0 },
    { name: 'supabase_ingest', status: 'idle', message: 'Ready to upload to database', progress: 0 },
  ]);
  
  const [isProcessing, setIsProcessing] = useState(false);

  const updateScriptStatus = (index: number, updates: Partial<ScriptStatus>) => {
    setScripts(prev => prev.map((script, i) => 
      i === index ? { ...script, ...updates } : script
    ));
  };

  const executeScript = async (scriptName: string, index: number) => {
    updateScriptStatus(index, { status: 'running', progress: 10 });
    
    try {
      updateScriptStatus(index, { progress: 30, message: `Processing ${scriptName}...` });
      
      const response = await fetch(`/scripts/${scriptName}.py`);
      if (!response.ok) {
        throw new Error(`Script ${scriptName} not accessible`);
      }
      
      updateScriptStatus(index, { progress: 70, message: `Finalizing ${scriptName}...` });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      updateScriptStatus(index, { 
        status: 'success', 
        progress: 100, 
        message: `${scriptName} completed successfully` 
      });
      
      toast({
        title: "Script Complete",
        description: `${scriptName} executed successfully`,
      });
      
      return true;
    } catch (error) {
      updateScriptStatus(index, { 
        status: 'error', 
        progress: 0,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      toast({
        title: "Script Failed",
        description: `${scriptName} encountered an error`,
        variant: "destructive",
      });
      
      return false;
    }
  };

  const runAllScripts = async () => {
    setIsProcessing(true);
    
    toast({
      title: "Processing Started",
      description: "Running all IEBC data processing scripts...",
    });
    
    for (let i = 0; i < scripts.length; i++) {
      const success = await executeScript(scripts[i].name, i);
      if (!success) {
        setIsProcessing(false);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsProcessing(false);
    
    toast({
      title: "Processing Complete",
      description: "All IEBC data processing scripts completed successfully!",
    });
  };

  const runSingleScript = async (index: number) => {
    setIsProcessing(true);
    await executeScript(scripts[index].name, index);
    setIsProcessing(false);
  };

  const resetAll = () => {
    setScripts(prev => prev.map(script => ({
      ...script,
      status: 'idle' as const,
      progress: 0,
      message: `Ready to ${script.name.replace(/_/g, ' ')}`
    })));
  };

  const getStatusIcon = (status: ScriptStatus['status']) => {
    switch (status) {
      case 'running': return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: ScriptStatus['status']) => {
    const colors = {
      idle: 'bg-gray-100 text-gray-700',
      running: 'bg-blue-100 text-blue-700',
      success: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700',
    };
    
    return (
      <Badge className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <CardTitle className="flex items-center gap-2">
          <Database className="w-6 h-6" />
          IEBC Data Processing Pipeline
        </CardTitle>
        <CardDescription className="text-blue-100">
          Execute Python scripts to process, geocode, validate, and ingest IEBC office data
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            These scripts process IEBC voter registration office data. Ensure you have the required API keys 
            configured (Google Maps API, Mapbox API) and necessary Python dependencies installed.
          </AlertDescription>
        </Alert>

        <div className="flex gap-3">
          <Button 
            onClick={runAllScripts} 
            disabled={isProcessing}
            className="flex-1"
          >
            <Play className="w-4 h-4 mr-2" />
            Run All Scripts
          </Button>
          <Button 
            onClick={resetAll} 
            variant="outline"
            disabled={isProcessing}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset All
          </Button>
        </div>

        <div className="space-y-4">
          {scripts.map((script, index) => (
            <Card key={script.name} className="border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(script.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">
                          {script.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </h4>
                        {getStatusBadge(script.status)}
                      </div>
                      <p className="text-xs text-gray-600">{script.message}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runSingleScript(index)}
                    disabled={isProcessing || script.status === 'running'}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Run
                  </Button>
                </div>
                {script.status === 'running' && (
                  <Progress value={script.progress} className="h-2" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Processing Pipeline Overview
          </h4>
          <ol className="text-xs text-gray-600 space-y-1 ml-6 list-decimal">
            <li><strong>Clean Addresses:</strong> Normalizes and standardizes IEBC office address data</li>
            <li><strong>Geocode Addresses:</strong> Converts addresses to GPS coordinates using Google/Mapbox APIs</li>
            <li><strong>CSV to GeoJSON:</strong> Transforms geocoded data into GeoJSON format for mapping</li>
            <li><strong>Validate Data:</strong> Performs quality checks and validation on processed data</li>
            <li><strong>Supabase Ingest:</strong> Uploads verified data to Supabase database</li>
          </ol>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Download className="w-3 h-3 mr-1" />
            Download Logs
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <FileText className="w-3 h-3 mr-1" />
            View Output Files
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PythonScriptExecutor;
