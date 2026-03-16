import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Logo from '@/components/Logo';
import FirmProfileTab from '@/components/settings/FirmProfileTab';
import DocumentTemplatesTab from '@/components/settings/DocumentTemplatesTab';
import IntakeQuestionsTab from '@/components/settings/IntakeQuestionsTab';

const FirmSettings = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo size="sm" />
          <span className="text-sm text-muted-foreground font-body hidden sm:block">Firm Settings</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/paralegal')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Button>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <h1 className="font-display font-bold text-2xl text-foreground mb-6">Firm Settings</h1>
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="bg-secondary/50 border border-border mb-6">
              <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">Firm Profile</TabsTrigger>
              <TabsTrigger value="templates" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">Document Templates</TabsTrigger>
              <TabsTrigger value="questions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">Intake Questions</TabsTrigger>
            </TabsList>
            <TabsContent value="profile"><FirmProfileTab /></TabsContent>
            <TabsContent value="templates"><DocumentTemplatesTab /></TabsContent>
            <TabsContent value="questions"><IntakeQuestionsTab /></TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
};

export default FirmSettings;
