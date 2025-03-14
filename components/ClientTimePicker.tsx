// components/ClientTimePicker.tsx
"use client";

import { TimePicker, TimePickerProps } from './ui/TimePicker/';

export function ClientTimePicker(props: TimePickerProps) {
  return <TimePicker {...props} />;
}