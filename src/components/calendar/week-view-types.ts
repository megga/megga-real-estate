
/**
 * Represents an event reminder
 */
export interface EventReminder {
  amount: number;
  unit: "minutes" | "hours" | "days";
}

/**
 * Represents a calendar event
 */
export interface CalendarEvent {
  /** Unique identifier for the event */
  id: string;
  /** Event title */
  title: string;
  /** Start date and time */
  start: Date;
  /** End date and time */
  end: Date;
  /** Whether this is an all-day event */
  isAllDay?: boolean;
  /** Event color (for styling) */
  color?: EventColor;
  /** Calendar ID this event belongs to */
  calendarId?: string;
  /** Optional description */
  description?: string;
  /** Optional location */
  location?: string;
  /** Timezone string (e.g. "GMT-3 Sao Paulo") */
  timezone?: string;
  /** Recurrence rule display string (e.g. "Every week on Thu") */
  recurrence?: string;
  /** Structured recurrence rule */
  recurrenceRule?: RecurrenceRule;
  /** ID of the parent recurring event (for generated instances) */
  recurringEventId?: string;
  /** Reminders list */
  reminders?: EventReminder[];
  /** Busy/Free status */
  status?: "busy" | "free";
  /** Visibility setting */
  visibility?: "default" | "public" | "private";
  /** Calendar account email for display */
  calendarEmail?: string;
  /** MEGGA CRM references */
  contactId?: string;
  propertyId?: string;
  /** MEGGA event type (visit / meeting / reminder / signing / deadline /
   * personal). 'visit' insère dans `visits`, les autres dans `reminders`
   * (avec type 'custom' + le label dans description). */
  meggaType?: 'visit' | 'meeting' | 'reminder' | 'signing' | 'deadline' | 'personal';
  /** MEGGA visit status */
  visitStatus?: VisitStatus;
  /** Post-visit feedback from buyer */
  feedbackBuyer?: string;
  /** Post-visit feedback/notes from agent */
  feedbackAgent?: string;
  /** Rating 1-5 */
  rating?: number;
}

/**
 * Recurrence frequency
 */
export type RecurrenceFrequency = "daily" | "weekly" | "biweekly" | "monthly";

/**
 * Structured recurrence rule for repeating events
 */
export interface RecurrenceRule {
  /** How often the event repeats */
  frequency: RecurrenceFrequency;
  /** End date for the recurrence (no instances after this date) */
  until?: Date;
  /** Number of occurrences (alternative to until) */
  count?: number;
}

/**
 * Visit status for MEGGA real estate events
 */
export type VisitStatus = "planned" | "confirmed" | "done" | "cancelled" | "no_show";

/**
 * Predefined event colors
 */
export type EventColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "gray";
