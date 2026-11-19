export type CorrespondenceStatus = 'sent' | 'read' | 'archived';
export type CorrespondencePriority = 'low' | 'normal' | 'high' | 'urgent';
export type CorrespondenceType = 'incoming' | 'outgoing';
export type UserRole = 'admin' | 'director' | 'dept_head' | 'external';

export interface Department {
  id: number;
  name: string;
  headName: string | null;
  headTitle: string | null;
  phone: string;
  email: string;
  office: string;
  headUserId: number | null;
}

export interface Attachment {
  id: number;
  fileName: string;
  sizeBytes: number;
  contentType: string | null;
  createdAt?: string;
}

export interface Correspondence {
  id: number;
  number: string;
  date: string;
  fromUserId: number;
  thread?: { id: number; number: string; date: string; subject: string; from: string; fromDepartment: string; to: string; toDepartment: string }[];
  toUserId: number;
  from: string;
  fromDepartment: string;
  to: string;
  toDepartment: string;
  subject: string;
  body: string;
  priority: CorrespondencePriority;
  status: CorrespondenceStatus;
  type: CorrespondenceType;
  readAt: string | null;
  repliedAt: string | null;
  replyToId: number | null;
  replyToNumber: string | null;
  attachmentCount: number;
  attachments?: Attachment[];
}

export interface Me {
  id: number;
  fullName: string;
  username: string;
  role: UserRole;
  departmentId: number | null;
  departmentName: string | null;
  externalEntityId?: number | null;
  externalEntityName?: string | null;
}

export interface UserRow {
  id: number;
  fullName: string;
  username: string;
  role: UserRole;
  departmentId: number | null;
  departmentName: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface DashboardStats {
  totalIncoming: number;
  totalOutgoing: number;
  unreadCount: number;
  urgentCount: number;
  todayCount: number;
  archivedCount: number;
  totalCount: number;
}

export interface AppNotification {
  id: number;
  correspondenceId: number | null;
  externalMessageId?: number | null;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ExternalEntity {
  id: number;
  name: string;
  sectionName: string;
  contactInfo: string;
  isActive: boolean;
  createdAt?: string;
  accountUsername?: string | null;
  accountActive?: boolean | null;
}

export type ExternalDirection = 'out' | 'in';

export interface ExternalMessage {
  id: number;
  number: string;
  direction: ExternalDirection;
  date: string;
  subject: string;
  archived: boolean;
  unread?: boolean;
  entityName: string;
  entitySection: string;
  createdByName: string;
  createdAt?: string;
}

export interface ExternalMessageDetail extends ExternalMessage {
  body: string;
  entity: { id: number; name: string; sectionName: string; contactInfo: string };
  attachments: Attachment[];
}

export const roleLabels: Record<UserRole, string> = {
  admin: 'مدير النظام',
  director: 'مدير المديرية',
  dept_head: 'رئيس قسم',
  external: 'جهة خارجية',
};

export const priorityLabels: Record<CorrespondencePriority, string> = {
  low: 'منخفض',
  normal: 'عادي',
  high: 'هام',
  urgent: 'عاجل',
};

export const statusLabels: Record<CorrespondenceStatus, string> = {
  sent: 'مرسلة',
  read: 'مقروءة',
  archived: 'مؤرشفة',
};

export function formatDateTime(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleString('ar-SY', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ar-SY', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;
}
