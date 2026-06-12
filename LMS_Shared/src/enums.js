/**
 * Canonical enums shared across backend, frontend, and the AI engine.
 * These are the single source of truth — never redefine these strings inline.
 */

export const UserRole = {
  STUDENT: 'student',
  TRAINER: 'trainer',
  ADMIN: 'admin',
};

export const UserStatus = {
  PENDING: 'pending', // awaiting admin approval (self-registration)
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
};

/** Manual attendance states a trainer can record after a class. */
export const AttendanceStatus = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  EXCUSED: 'excused',
};

/** Where a class is hosted. */
export const MeetingProvider = {
  ZOOM: 'zoom',
  GOOGLE_MEET: 'google_meet',
  MS_TEAMS: 'ms_teams',
  OTHER: 'other',
};

export const ClassStatus = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/** Assessment kind. Practice tests are unlocked by trainers; the final gates the next module. */
export const AssessmentType = {
  PRACTICE: 'practice',
  FINAL: 'final',
};

/** Question formats supported by the assessment engine. */
export const QuestionType = {
  MCQ: 'mcq',
  SCENARIO: 'scenario',
  PROMPT_WRITING: 'prompt_writing',
  CODING: 'coding',
};

/** Locked until the trainer opens it after finishing the matching syllabus section. */
export const AssessmentAvailability = {
  LOCKED: 'locked',
  UNLOCKED: 'unlocked',
};

export const SubmissionStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  EVALUATING: 'evaluating',
  GRADED: 'graded',
};

/** A student's standing on a single module within their learning path. */
export const ModuleProgressStatus = {
  LOCKED: 'locked',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

export const ResourceType = {
  VIDEO: 'video',
  DOCUMENT: 'document',
  PRESENTATION: 'presentation',
  LINK: 'link',
  ASSIGNMENT: 'assignment',
};

export const SkillLevel = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert',
};

/** Student doubt / Q&A thread status. */
export const DoubtStatus = {
  OPEN: 'open',
  ANSWERED: 'answered',
  CLOSED: 'closed',
};

export const ThemeName = {
  GREEN: 'green',
  ORANGE: 'orange',
};

export const ThemeMode = {
  LIGHT: 'light',
  DARK: 'dark',
};
