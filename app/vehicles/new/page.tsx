import { CarFront } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NewVehicleForm } from './new-vehicle-form';

export const metadata = {
  title: 'Add a Vehicle'
};

export default function NewVehiclePage() {
  return (
    <main className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-md shadow-primary/25">
            <CarFront className="h-5 w-5" />
          </span>
          <CardTitle className="text-2xl">Add a vehicle</CardTitle>
          <CardDescription>
            Register one of your vehicles so you can offer rides with it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewVehicleForm />
        </CardContent>
      </Card>
    </main>
  );
}
