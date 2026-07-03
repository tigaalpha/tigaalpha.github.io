import "server-only";
import type { Repositories } from "@/services/repositories";
import type { CalendarService } from "@/services/google/calendar.service";
import type { LessonEventType, Tables } from "@/types/database";

export interface BookLessonInput {
  customerId: string;
  teacherId: string;
  startTime: string;
  endTime: string;
}

export interface BookLessonResult {
  booking: Tables<"bookings">;
  lessonNumber: number;
  lessonType: LessonEventType;
}

/**
 * Formats the calendar event title per PRD: "<hour><StudentName>", e.g.
 * 1TONY .. 40TONY, where <hour> is the lesson number the student is about
 * to attend (current_hour + 1).
 */
export function formatEventTitle(lessonNumber: number, studentName: string): string {
  const normalizedName = studentName.trim().replace(/\s+/g, "").toUpperCase();
  return `${lessonNumber}${normalizedName}`;
}

export function resolveLessonType(lessonNumber: number, totalHours: number): LessonEventType {
  return lessonNumber >= totalHours ? "final" : "normal";
}

export class BookingService {
  constructor(private readonly repos: Repositories, private readonly calendar: CalendarService) {}

  async book(input: BookLessonInput): Promise<BookLessonResult> {
    const [customer, course] = await Promise.all([
      this.repos.customers.findById(input.customerId),
      this.repos.courses.findActiveForCustomer(input.customerId),
    ]);

    if (!customer) throw new Error(`Customer ${input.customerId} not found`);
    if (!course) throw new Error(`Customer ${input.customerId} has no active course with remaining hours`);

    const hasConflict = await this.repos.bookings.hasConflict(input.teacherId, input.startTime, input.endTime);
    if (hasConflict) {
      throw new Error("Teacher already has a lesson booked in this time range");
    }

    const lessonNumber = course.current_hour + 1;
    const lessonType = resolveLessonType(lessonNumber, course.total_hours);
    const title = formatEventTitle(lessonNumber, customer.name);

    const event = await this.calendar.createEvent({
      title,
      startTime: input.startTime,
      endTime: input.endTime,
      lessonType,
    });

    const booking = await this.repos.bookings.create({
      customer_id: input.customerId,
      course_id: course.id,
      teacher_id: input.teacherId,
      google_event_id: event.id,
      title,
      lesson_type: lessonType,
      status: "confirmed",
      start_time: input.startTime,
      end_time: input.endTime,
    });

    return { booking, lessonNumber, lessonType };
  }

  async reschedule(bookingId: string, newStart: string, newEnd: string): Promise<Tables<"bookings">> {
    const booking = await this.repos.bookings.findById(bookingId);
    if (!booking) throw new Error(`Booking ${bookingId} not found`);

    if (booking.teacher_id) {
      const hasConflict = await this.repos.bookings.hasConflict(booking.teacher_id, newStart, newEnd, bookingId);
      if (hasConflict) throw new Error("Teacher already has a lesson booked in this time range");
    }

    if (booking.google_event_id) {
      await this.calendar.updateEvent(booking.google_event_id, { startTime: newStart, endTime: newEnd });
    }

    return this.repos.bookings.update(bookingId, { start_time: newStart, end_time: newEnd, status: "rescheduled" });
  }

  async cancel(bookingId: string): Promise<Tables<"bookings">> {
    const booking = await this.repos.bookings.findById(bookingId);
    if (!booking) throw new Error(`Booking ${bookingId} not found`);

    if (booking.google_event_id) {
      await this.calendar.deleteEvent(booking.google_event_id);
    }

    return this.repos.bookings.cancel(bookingId);
  }

  async complete(bookingId: string): Promise<Tables<"bookings">> {
    return this.repos.bookings.update(bookingId, { status: "completed" });
  }
}
