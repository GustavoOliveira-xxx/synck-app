// Cópia gerada de app-mobile/src/models/types.ts por scripts/copiar-logica-push.mjs. Não edite aqui.
// Tipos de dados do app. Eles espelham as tabelas e funções do banco
// (veja MODELO_DE_DADOS.md). Datas vêm do servidor como texto ISO 8601.

export type Role = 'owner' | 'admin' | 'editor' | 'collaborator' | 'viewer';

export type CalendarKind = 'personal' | 'shared' | 'family' | 'work' | 'project' | 'travel' | 'custom';

export type ConflictPolicy = 'warn' | 'block' | 'ignore';

export type EventType =
  | 'appointment'
  | 'meeting'
  | 'task'
  | 'reminder'
  | 'birthday'
  | 'travel'
  | 'holiday'
  | 'social'
  | 'work'
  | 'custom';

export type EventStatus = 'planned' | 'confirmed' | 'completed' | 'cancelled' | 'postponed' | 'archived';

export type EventPrivacy = 'members' | 'participants' | 'private' | 'busy';

/** Data local sem horário, no formato AAAA-MM-DD (ex.: 2026-12-25). */
export type DateKey = string;

export interface Calendar {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  kind: CalendarKind;
  status: 'active' | 'archived';
  default_timezone: string;
  default_member_role: Exclude<Role, 'owner'>;
  admins_can_invite: boolean;
  members_can_invite: boolean;
  editors_can_edit_all: boolean;
  allow_private_events: boolean;
  conflict_policy: ConflictPolicy;
  notify_members_on_changes: boolean;
  owner_id: string;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  my_role: Role;
  my_notifications_enabled: boolean;
  member_count: number;
}

export interface RecurrenceException {
  original_date: DateKey;
  is_cancelled: boolean;
  title: string | null;
  description: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

/** Campos de um evento que o app pode enviar ao servidor. */
export interface EventFields {
  decoration?: string | null;
  title: string;
  description: string | null;
  location: string | null;
  address: string | null;
  url: string | null;
  all_day: boolean;
  starts_at: string;
  ends_at: string;
  start_date: DateKey | null;
  end_date: DateKey | null;
  timezone: string;
  recurrence_rule: string | null;
  assignee_id: string | null;
  color: string | null;
  event_type: EventType;
  status: EventStatus;
  privacy: EventPrivacy;
}

export interface CalendarEvent extends Omit<EventFields, 'title'> {
  id: string;
  calendar_id: string;
  /** null quando o evento está mascarado ("Ocupado"). */
  title: string | null;
  created_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  completed_at: string | null;
  is_masked: boolean;
  exceptions: RecurrenceException[];
  attendee_ids: string[];
  my_reminders: number[];
  /** Preenchido apenas em respostas de escrita (evento na lixeira). */
  deleted_at?: string | null;
  /** Somente no app: o evento tem alterações ainda não enviadas. */
  pending?: boolean;
  /** Bloco de tempo: a tarefa que este evento reserva. */
  task_id?: string | null;
  /** Identificador do evento de origem (importação de arquivo .ics). */
  external_uid?: string | null;
}

/** Uma ocorrência concreta de um evento (eventos recorrentes geram várias). */
export interface Occurrence {
  key: string;
  event: CalendarEvent;
  /** Data local (no fuso do evento) da ocorrência original na série. */
  originalDate: DateKey;
  start: Date;
  end: Date;
  allDay: boolean;
  /** Para eventos de dia inteiro: datas locais (inclusivas). */
  startDate: DateKey | null;
  endDate: DateKey | null;
  title: string | null;
  description: string | null;
  location: string | null;
  isRecurring: boolean;
  isException: boolean;
}

export interface Member {
  member_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  last_activity_at: string | null;
  display_name: string;
  avatar_color: string;
  notifications_enabled: boolean | null;
  is_me: boolean;
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'exhausted';

export interface InvitationSummary {
  id: string;
  invited_email: string | null;
  role: Exclude<Role, 'owner'>;
  code_hint: string;
  created_at: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  status: InvitationStatus;
  created_by_name: string;
  accepted_by_name: string | null;
}

export interface CreatedInvitation {
  id: string;
  code: string;
  role: Exclude<Role, 'owner'>;
  expires_at: string | null;
  max_uses: number | null;
  invited_email: string | null;
}

export interface InvitationPreview {
  ok: boolean;
  error?: string;
  invitation_id?: string;
  status?: InvitationStatus;
  calendar_id?: string;
  calendar_name?: string;
  calendar_color?: string;
  calendar_kind?: CalendarKind;
  role?: Exclude<Role, 'owner'>;
  inviter_name?: string;
  expires_at?: string | null;
  already_member?: boolean;
}

export interface ReceivedInvitation {
  id: string;
  calendar_id: string;
  calendar_name: string;
  calendar_color: string;
  role: Exclude<Role, 'owner'>;
  inviter_name: string;
  created_at: string;
  expires_at: string | null;
}

export type ThemePreference = 'system' | 'light' | 'dark';
export type DateFormat = 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'MM/dd/yyyy';
export type TimeFormat = '24h' | '12h';

export interface RoutinePeriod {
  id: string;
  title: string;
  kind: 'work' | 'school' | 'sleep' | 'commute' | 'meal' | 'exercise' | 'care' | 'custom';
  days: number[];
  start: string;
  end: string;
  timezone: string;
  enabled: boolean;
}

export interface UserPreferences {
  routine_periods?: RoutinePeriod[];
  locale: 'pt-BR';
  timezone: string;
  use_device_timezone: boolean;
  date_format: DateFormat;
  time_format: TimeFormat;
  theme: ThemePreference;
  week_starts_on: 0 | 1;
  /** Perguntar "O que você pretende fazer hoje?" na primeira abertura do dia. */
  daily_checkin: boolean;
  /** Pessoas das agendas compartilhadas veem só os horários ocupados (sem detalhes). */
  share_availability: boolean;
  /** Janela do dia usada no planejador e nos horários livres (HH:MM:SS). */
  day_start: string;
  day_end: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  show_details_on_lock_screen: boolean;
  default_reminder_minutes: number | null;
  notify_invites: boolean;
  notify_event_changes: boolean;
  notify_member_changes: boolean;
  notify_comments: boolean;
  notify_reminders: boolean;
  notify_tasks: boolean;
  sound: boolean;
  vibration: boolean;
}

export interface Account {
  id: string;
  email: string;
  email_confirmed: boolean;
  display_name: string;
  avatar_color: string;
  avatar_url: string | null;
  account_status: 'active' | 'suspended' | 'pending_deletion';
  created_at: string;
  last_seen_at: string | null;
  preferences: UserPreferences;
  notification_preferences: NotificationPreferences;
}

export type NotificationType =
  | 'invite_received'
  | 'invite_accepted'
  | 'invite_declined'
  | 'event_created'
  | 'event_updated'
  | 'event_cancelled'
  | 'event_deleted'
  | 'member_added'
  | 'member_removed'
  | 'role_changed'
  | 'ownership_received'
  | 'comment_added'
  | 'task_assigned'
  | 'task_completed'
  | 'task_comment'
  | 'poll_created'
  | 'poll_closed';

export interface AppNotification {
  id: string;
  type: NotificationType;
  calendar_id: string | null;
  event_id: string | null;
  actor_id: string | null;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface ActivityEntry {
  id: number;
  calendar_id: string;
  event_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  actor_id: string | null;
  actor_name: string;
  member_name: string | null;
}

export interface EventComment {
  id: string;
  author_id: string | null;
  author_name: string;
  author_color: string;
  body: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  is_mine: boolean;
}

export interface Device {
  id: string;
  installation_id: string;
  platform: 'android' | 'ios' | 'web';
  device_name: string | null;
  os_version: string | null;
  app_version: string | null;
  last_seen_at: string;
  created_at: string;
}

export interface DeletionImpact {
  blocking_calendars: { id: string; name: string; member_count: number }[];
  calendars_to_delete: number;
  events_kept_in_shared_calendars: number;
  comments_to_delete: number;
}

// ---------------------------------------------------------------------
// Versão 3.0: tarefas, lembretes, listas, anotações, hábitos e enquetes
// ---------------------------------------------------------------------

/** Tarefa (atividade com conclusão) ou lembrete (aviso numa data). */
export type ItemType = 'task' | 'reminder';

export type TaskStatus = 'pending' | 'in_progress' | 'waiting' | 'done' | 'cancelled';

/** 0 sem prioridade, 1 baixa, 2 média, 3 alta, 4 urgente. */
export type TaskPriority = 0 | 1 | 2 | 3 | 4;

export type TaskPrivacy = 'members' | 'participants' | 'private';

/** calendar: datas da regra ("todo dia 5"); completion: intervalo após a última conclusão. */
export type RecurrenceMode = 'calendar' | 'completion';

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
  done_at: string | null;
  done_by: string | null;
  position: number;
}

/** Campos de uma tarefa que o app pode enviar ao servidor. */
export interface TaskFields {
  decoration?: string | null;
  item_type: ItemType;
  calendar_id: string | null;
  list_id: string | null;
  title: string;
  description: string | null;
  links: string[];
  tags: string[];
  start_date: DateKey | null;
  due_date: DateKey | null;
  /** HH:MM ou HH:MM:SS, no fuso da tarefa. */
  due_time: string | null;
  timezone: string;
  estimated_minutes: number | null;
  priority: TaskPriority;
  status: TaskStatus;
  recurrence_rule: string | null;
  recurrence_mode: RecurrenceMode;
  assignee_id: string | null;
  privacy: TaskPrivacy;
  position: number;
}

export interface Task extends TaskFields {
  id: string;
  recurrence_start: DateKey | null;
  created_by: string | null;
  updated_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  checklist: ChecklistItem[];
  participant_ids: string[];
  my_alerts: number[];
  /** Dia em que a pessoa pretende fazer a tarefa ("Meu dia"). */
  plan_day: DateKey | null;
  last_completed_at: string | null;
  comment_count: number;
  /** Somente no app: alterações ainda não enviadas. */
  pending?: boolean;
}

export interface TaskList {
  id: string;
  calendar_id: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  created_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  pending?: boolean;
}

export interface Note {
  decoration?: string | null;
  id: string;
  calendar_id: string | null;
  title: string | null;
  body: string;
  pinned: boolean;
  event_id: string | null;
  task_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  pending?: boolean;
}

export type HabitStatus = 'active' | 'paused' | 'archived';

export interface Habit {
  decoration?: string | null;
  id: string;
  calendar_id: string | null;
  title: string;
  description: string | null;
  color: string | null;
  recurrence_rule: string;
  start_date: DateKey;
  status: HabitStatus;
  show_streak: boolean;
  created_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  logs: { user_id: string; day: DateKey }[];
  pending?: boolean;
}

export interface TaskComment {
  id: string;
  author_id: string | null;
  author_name: string;
  author_color: string;
  body: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  is_mine: boolean;
}

export interface TaskHistoryEntry {
  kind: 'activity' | 'completion';
  action?: string;
  details?: Record<string, unknown>;
  occurrence_date?: DateKey | null;
  at: string;
  actor_name: string;
}

export type PollAnswer = 'yes' | 'maybe' | 'no';

export interface Poll {
  id: string;
  calendar_id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  timezone: string;
  status: 'open' | 'closed' | 'scheduled';
  closes_at: string | null;
  chosen_option_id: string | null;
  event_id: string | null;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  participants: { user_id: string; display_name: string }[];
  options: {
    id: string;
    starts_at: string;
    ends_at: string;
    votes: { user_id: string; answer: PollAnswer }[];
  }[];
}

/** Horário ocupado de alguém (sem título nem detalhes). */
export interface BusyEvent {
  user_id: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  start_date: DateKey | null;
  end_date: DateKey | null;
  timezone: string;
  recurrence_rule: string | null;
  exceptions: Pick<RecurrenceException, 'original_date' | 'is_cancelled' | 'starts_at' | 'ends_at'>[];
}

export interface MyItems {
  lists: TaskList[];
  tasks: Task[];
  notes: Note[];
  habits: Habit[];
  checkins: DateKey[];
}
