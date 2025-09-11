
'use client';

import { Container } from "@/components/shared/Container";
import { PageTitle } from "@/components/shared/PageTitle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConstructionIcon, ArrowUpFromLineIcon, ArrowDownToLineIcon } from "lucide-react";
import { WorkshopDropOffForm } from "@/components/admin/workshop/WorkshopDropOffForm";
import { WorkshopPickUpList } from "@/components/admin/workshop/WorkshopPickUpList";


export default function OperatorWorkshopPage() {

    return (
        <Container>
            <PageTitle
                title="Gestão de Oficina"
                description="Registre a entrada e saída de veículos para manutenção externa."
                icon={<ConstructionIcon className="w-6 h-6 mr-2 text-primary" />}
            />

            <Tabs defaultValue="drop-off" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 md:w-[500px]">
                    <TabsTrigger value="drop-off" className="text-sm">
                        <ArrowUpFromLineIcon className="w-4 h-4 mr-2" />
                        Entregar Veículo na Oficina
                    </TabsTrigger>
                    <TabsTrigger value="pick-up" className="text-sm">
                        <ArrowDownToLineIcon className="w-4 h-4 mr-2" />
                        Retirar Veículo da Oficina
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="drop-off">
                    <WorkshopDropOffForm />
                </TabsContent>
                <TabsContent value="pick-up">
                    <WorkshopPickUpList />
                </TabsContent>
            </Tabs>
        </Container>
    );
}
