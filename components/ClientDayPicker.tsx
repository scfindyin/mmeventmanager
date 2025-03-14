"use client";

import { DayPicker } from './ui/DayPicker';

// Define the props interface
interface ClientDayPickerProps {
  onChange?: (date: Date) => void;
  label?: string;
  initialDate?: Date;
  // Add any other props your DayPicker component accepts
}

export function ClientDayPicker(props: ClientDayPickerProps) {
  return <DayPicker {...props} />;
}