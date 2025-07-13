
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, FileText, Users, Scale, CheckCircle } from 'lucide-react';

const ConstitutionalFlowchart = () => {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const flowSteps = [
    {
      id: 1,
      title: "Legal Grounds",
      description: "Article 104 violations with documented evidence",
      icon: Scale,
      color: "bg-red-500 dark:bg-red-600",
      textColor: "text-red-700 dark:text-red-300",
      bgColor: "bg-red-50 dark:bg-red-900/20",
      borderColor: "border-red-200 dark:border-red-700"
    },
    {
      id: 2,
      title: "Collect Signatures",
      description: "30% of registered voters with KICA-certified signatures",
      icon: Users,
      color: "bg-blue-500 dark:bg-blue-600",
      textColor: "text-blue-700 dark:text-blue-300",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      borderColor: "border-blue-200 dark:border-blue-700"
    },
    {
      id: 3,
      title: "IEBC Review",
      description: "Official recall election within 90 days",
      icon: CheckCircle,
      color: "bg-green-500 dark:bg-green-600",
      textColor: "text-green-700 dark:text-green-300",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-700"
    }
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white text-center">Constitutional Recall Process</h3>
      
      {/* Desktop View */}
      <div className="hidden md:flex items-center justify-center space-x-4">
        {flowSteps.map((step, index) => (
          <React.Fragment key={step.id}>
            <Card 
              className={`w-72 transition-all duration-300 cursor-pointer ${step.borderColor} ${
                hoveredStep === step.id ? 'shadow-lg scale-105' : 'shadow-md'
              } ${step.bgColor}`}
              onMouseEnter={() => setHoveredStep(step.id)}
              onMouseLeave={() => setHoveredStep(null)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${step.color}`}>
                    <step.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Badge variant="outline" className={`${step.textColor} ${step.borderColor}`}>
                      Step {step.id}
                    </Badge>
                    <CardTitle className={`text-lg mt-1 ${step.textColor}`}>
                      {step.title}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className={`text-sm ${step.textColor}`}>
                  {step.description}
                </p>
              </CardContent>
            </Card>
            
            {index < flowSteps.length - 1 && (
              <ArrowRight className="w-6 h-6 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile View - Always Visible */}
      <div className="md:hidden space-y-4">
        {flowSteps.map((step, index) => (
          <React.Fragment key={step.id}>
            <Card className={`${step.borderColor} ${step.bgColor} shadow-md`}>
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${step.color}`}>
                    <step.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Badge variant="outline" className={`${step.textColor} ${step.borderColor}`}>
                      Step {step.id}
                    </Badge>
                    <CardTitle className={`text-lg mt-1 ${step.textColor}`}>
                      {step.title}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className={`text-sm ${step.textColor}`}>
                  {step.description}
                </p>
              </CardContent>
            </Card>
            
            {index < flowSteps.length - 1 && (
              <div className="flex justify-center">
                <ArrowRight className="w-6 h-6 text-gray-400 dark:text-gray-500 rotate-90" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ConstitutionalFlowchart;
