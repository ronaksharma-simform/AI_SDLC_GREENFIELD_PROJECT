'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { RequestJoinForm } from '@/components/request-join-form';

interface RequestJoinDialogProps {
  rideId: string;
  seatsAvailable: number;
}

/**
 * "Request to Join" entry point on the Seeker's Ride Detail view (Section 5.9).
 *
 * The gradient "Request to Join" button opens a modal dialog containing the
 * seat-count + optional-message form. On success the dialog closes and the
 * server page re-renders with the active-request status badge in place of the
 * button (the page's `activeRequest` branch).
 */
export function RequestJoinDialog({ rideId, seatsAvailable }: RequestJoinDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto">
          Request to Join
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request to join</DialogTitle>
          <DialogDescription>
            {seatsAvailable} seat(s) available on this ride. Tell the provider a little about your
            plan.
          </DialogDescription>
        </DialogHeader>
        <RequestJoinForm
          rideId={rideId}
          seatsAvailable={seatsAvailable}
          onSubmitted={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
