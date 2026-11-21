import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { DayPanelContent } from '@/components/day-panel-content';
import { Button } from '@/components/ui/button';
import type { DayData } from '@/types';

export function DayView({
    date,
    dayData,
    updateData,
    onBack,
}: {
    date: Date;
    dayData: DayData;
    updateData: (updater: (prev: DayData) => DayData) => void;
    onBack: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground"
        >
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10"
                        onClick={onBack}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {format(date, 'EEEE')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {format(date, 'MMMM d, yyyy')}
                        </p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="mx-auto max-w-2xl">
                    {/* Keyed on the date so a different day starts with fresh
                        local state (note draft, open dialog). */}
                    <DayPanelContent
                        key={format(date, 'yyyy-MM-dd')}
                        date={date}
                        dayData={dayData}
                        updateData={updateData}
                    />
                </div>
            </div>
        </motion.div>
    );
}
