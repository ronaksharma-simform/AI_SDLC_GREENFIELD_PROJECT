'use client';

import * as React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  errors?: string[];
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Reusable form-field wrapper used by every form in the app.
 *
 * Renders a label, the control (passed as `children`), an optional hint, and
 * per-field validation errors in a consistent stack so spacing, typography, and
 * error presentation stay identical across the login, signup, vehicle, and ride
 * forms.
 */
export function Field({ label, htmlFor, hint, errors, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint && !errors?.length ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {errors?.map((message) => (
        <p key={message} role="alert" className="text-xs font-medium text-destructive">
          {message}
        </p>
      ))}
    </div>
  );
}
